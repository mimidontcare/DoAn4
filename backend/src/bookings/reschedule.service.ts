import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingAction,
  BookingStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { toZoned } from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import type { BookingDetailView } from './booking.select';
import {
  transitionBooking,
  updateBookingInPlace,
  VERSION_CONFLICT,
} from './booking-state';
import { BookingsService } from './bookings.service';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { PricingService, totalsOf } from './pricing.service';
import {
  findBusyStaffIds,
  findOnLeaveStaffIds,
  lockStaffRows,
  STAFF_LOCK_TX_OPTIONS,
} from './staff-schedule';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

export interface RescheduleOptions {
  availableStartTimes: Date[];
  surchargePercent: number;
  total: number;
  blockedDate: { reason: string | null } | null;
  remainingReschedules: number;
}

const RESCHEDULE_SELECT = {
  id: true,
  status: true,
  version: true,
  zoneId: true,
  startAt: true,
  staffCount: true,
  durationMinutes: true,
  rescheduleCount: true,
  minCharge: true,
  items: { select: { quantity: true, unitPrice: true, minutesPerUnit: true } },
  assignments: { select: { staffId: true } },
} satisfies Prisma.BookingSelect;

type ReschedulableBooking = Prisma.BookingGetPayload<{
  select: typeof RESCHEDULE_SELECT;
}>;

/**
 * R01: khách đổi giờ khi PENDING/CONFIRMED, còn đủ giờ trước giờ bắt đầu, tối đa
 * số lần theo cấu hình, chỉ đổi thời gian. Nhóm cũ còn rảnh ở giờ mới thì giữ,
 * không thì gỡ nhóm và đơn về PENDING (mục 3.2).
 */
@Injectable()
export class RescheduleService {
  private readonly tz: string;
  private readonly maxReschedules: number;
  private readonly minHoursBefore: number;
  private readonly bufferMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly pricing: PricingService,
    private readonly availability: AvailabilityService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<string>('timezone');
    this.maxReschedules = config.getOrThrow<number>('booking.maxReschedules');
    this.minHoursBefore = config.getOrThrow<number>('booking.cancelMinHours');
    this.bufferMs =
      config.getOrThrow<number>('booking.staffBufferMinutes') * MS_PER_MINUTE;
  }

  /** Giờ trống của ngày mới (không tính chính đơn này) và giá theo ngày mới. */
  async options(
    customerId: number,
    id: number,
    date: string,
  ): Promise<RescheduleOptions> {
    const booking = await this.loadOwned(customerId, id);
    const now = new Date();
    this.assertReschedulable(booking, now);
    const surchargePercent = this.pricing.surchargePercentOn(date);
    const [times, blockedDate] = await Promise.all([
      this.availability.listStartTimes(
        booking.zoneId,
        date,
        booking.staffCount,
        booking.durationMinutes,
        now,
        booking.id,
      ),
      this.availability.findBlockedDate(this.prisma, date),
    ]);
    return {
      availableStartTimes: times.filter(
        (t) => t.getTime() !== booking.startAt.getTime(),
      ),
      surchargePercent,
      total: totalsOf(booking.items, booking.minCharge, surchargePercent).total,
      blockedDate,
      remainingReschedules: this.maxReschedules - booking.rescheduleCount,
    };
  }

  async reschedule(
    customerId: number,
    id: number,
    dto: RescheduleBookingDto,
  ): Promise<BookingDetailView> {
    const booking = await this.loadOwned(customerId, id);
    this.assertReschedulable(booking, new Date());
    const startAt = new Date(dto.startAt);
    if (startAt.getTime() === booking.startAt.getTime()) {
      throw new UnprocessableEntityException('Giờ mới trùng giờ hiện tại');
    }
    this.availability.assertStartTimeAllowed(startAt, booking.durationMinutes);
    const surchargePercent = this.pricing.surchargePercentAt(startAt);
    const totals = totalsOf(booking.items, booking.minCharge, surchargePercent);
    // Chỉ để phát hiện giá đổi (phụ phí theo ngày), không dùng làm giá (P01).
    if (dto.expectedTotal !== totals.total) {
      throw new ConflictException('Giá đã thay đổi, vui lòng xem lại');
    }
    const endAt = this.availability.endOf(startAt, booking.durationMinutes);
    const members = booking.assignments.map((a) => a.staffId);

    await this.prisma.$transaction(async (tx) => {
      // T06: khóa nhóm hiện tại trước mọi truy vấn khác, như khi phân công.
      await lockStaffRows(tx, members);
      const fresh = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: { id: true, status: true, version: true },
      });
      if (fresh.version !== booking.version) {
        throw new ConflictException(VERSION_CONFLICT);
      }
      await this.availability.assertNotBlocked(tx, startAt);

      const keepTeam =
        members.length > 0 &&
        (await this.isTeamFree(tx, booking, members, startAt, endAt));
      if (!keepTeam) {
        const available = await this.availability.isSlotAvailable(
          tx,
          booking.zoneId,
          startAt,
          booking.staffCount,
          booking.durationMinutes,
          booking.id,
        );
        if (!available) {
          throw new ConflictException(
            'Giờ này vừa hết chỗ, vui lòng chọn giờ khác',
          );
        }
      }

      const data: Prisma.BookingUncheckedUpdateManyInput = {
        startAt,
        endAt,
        rescheduleCount: { increment: 1 },
        surchargePercent,
        surcharge: totals.surcharge,
        totalPrice: totals.total,
      };
      const note = `Đổi lịch từ ${this.format(booking.startAt)} sang ${this.format(startAt)}`;
      if (keepTeam) {
        await updateBookingInPlace(tx, {
          booking: fresh,
          action: BookingAction.RESCHEDULE,
          changedBy: customerId,
          note,
          data,
        });
        return;
      }
      if (fresh.status === BookingStatus.CONFIRMED) {
        await transitionBooking(tx, {
          booking: fresh,
          to: BookingStatus.PENDING,
          action: BookingAction.RESCHEDULE,
          changedBy: customerId,
          note: `${note}; nhóm cũ không rảnh ở giờ mới`,
          data,
        });
      } else {
        await updateBookingInPlace(tx, {
          booking: fresh,
          action: BookingAction.RESCHEDULE,
          changedBy: customerId,
          note,
          data,
        });
      }
      if (members.length > 0) {
        await tx.bookingAssignment.deleteMany({ where: { bookingId: id } });
      }
    }, STAFF_LOCK_TX_OPTIONS);
    return this.bookings.getOwned(customerId, id);
  }

  private async loadOwned(
    customerId: number,
    id: number,
  ): Promise<ReschedulableBooking> {
    await this.bookings.findOwnedOrThrow(customerId, id);
    return this.prisma.booking.findUniqueOrThrow({
      where: { id },
      select: RESCHEDULE_SELECT,
    });
  }

  private assertReschedulable(booking: ReschedulableBooking, now: Date) {
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new UnprocessableEntityException(
        'Chỉ đổi lịch được đơn đang chờ hoặc đã xác nhận',
      );
    }
    if (booking.rescheduleCount >= this.maxReschedules) {
      throw new UnprocessableEntityException(
        `Mỗi đơn chỉ đổi lịch tối đa ${this.maxReschedules} lần`,
      );
    }
    const hoursLeft = (booking.startAt.getTime() - now.getTime()) / MS_PER_HOUR;
    if (hoursLeft < this.minHoursBefore) {
      throw new UnprocessableEntityException(
        `Chỉ đổi lịch được khi còn ít nhất ${this.minHoursBefore} giờ trước giờ bắt đầu`,
      );
    }
  }

  /** Cả nhóm còn hoạt động, thuộc khu vực, không nghỉ, không vướng đơn khác ở giờ mới. */
  private async isTeamFree(
    tx: Prisma.TransactionClient,
    booking: ReschedulableBooking,
    members: number[],
    startAt: Date,
    endAt: Date,
  ): Promise<boolean> {
    const eligible = await tx.user.count({
      where: {
        id: { in: members },
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        staffZones: { some: { zoneId: booking.zoneId } },
      },
    });
    if (eligible !== members.length) return false;
    const [onLeave, busy] = await Promise.all([
      findOnLeaveStaffIds(tx, members, startAt, endAt),
      findBusyStaffIds(tx, members, startAt, endAt, {
        bufferMs: this.bufferMs,
        excludeBookingId: booking.id,
      }),
    ]);
    return onLeave.size === 0 && busy.size === 0;
  }

  private format(date: Date): string {
    return toZoned(date, this.tz).format('HH:mm DD/MM/YYYY');
  }
}
