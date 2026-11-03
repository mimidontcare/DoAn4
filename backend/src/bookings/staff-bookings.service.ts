import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingAction, BookingStatus, CancelReason } from '@prisma/client';
import dayjs from 'dayjs';
// Nạp plugin utc, timezone cho dayjs.
import '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustmentService } from './adjustment.service';
import {
  STAFF_BOOKING_DETAIL_SELECT,
  STAFF_BOOKING_SUMMARY_SELECT,
  StaffBookingDetailView,
  StaffBookingSummaryView,
  toStaffBookingDetail,
} from './booking.select';
import {
  assertCheckInWindow,
  assertNoPendingAdjustment,
  assertNoShowAllowed,
  recordPayment,
  StaffTimePolicy,
  transitionBooking,
} from './booking-state';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { DeclineBookingDto } from './dto/decline-booking.dto';
import { ProposeAdjustmentDto } from './dto/propose-adjustment.dto';
import { StaffScheduleQueryDto } from './dto/staff-schedule-query.dto';

const MEMBERSHIP_SELECT = {
  id: true,
  status: true,
  version: true,
  startAt: true,
  serviceId: true,
  customerId: true,
  paymentStatus: true,
  adjustmentStatus: true,
  originalManMinutes: true,
} as const;

/**
 * S01–S07: nhân viên chỉ thao tác trên đơn mình được giao (chống IDOR);
 * thao tác của trưởng nhóm thì thành viên thường bị 403.
 */
@Injectable()
export class StaffBookingsService {
  private readonly tz: string;
  private readonly maxDays: number;
  private readonly timePolicy: StaffTimePolicy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adjustment: AdjustmentService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<string>('timezone');
    this.maxDays = config.getOrThrow<number>('booking.staffScheduleMaxDays');
    this.timePolicy = {
      checkInEarlyMinutes: config.getOrThrow<number>(
        'booking.checkInEarlyMinutes',
      ),
      checkInLateMinutes: config.getOrThrow<number>(
        'booking.checkInLateMinutes',
      ),
      noShowAfterMinutes: config.getOrThrow<number>(
        'booking.noShowAfterMinutes',
      ),
    };
  }

  /** S01: lịch theo khoảng ngày (theo múi giờ nghiệp vụ), gồm cả ngày cuối. */
  async list(
    staffId: number,
    query: StaffScheduleQueryDto,
  ): Promise<StaffBookingSummaryView[]> {
    const from = dayjs.tz(query.from, this.tz);
    const to = dayjs.tz(query.to, this.tz).add(1, 'day');
    const days = to.diff(from, 'day');
    if (days < 1 || days > this.maxDays) {
      throw new UnprocessableEntityException(
        `Khoảng ngày phải từ 1 đến ${this.maxDays} ngày`,
      );
    }
    const rows = await this.prisma.bookingAssignment.findMany({
      where: {
        staffId,
        booking: { startAt: { gte: from.toDate(), lt: to.toDate() } },
      },
      orderBy: { booking: { startAt: 'asc' } },
      select: {
        isLeader: true,
        booking: { select: STAFF_BOOKING_SUMMARY_SELECT },
      },
    });
    return rows.map((row) => ({ ...row.booking, isLeader: row.isLeader }));
  }

  async get(staffId: number, id: number): Promise<StaffBookingDetailView> {
    const { booking, isLeader } = await this.findMembership(staffId, id);
    const row = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      select: STAFF_BOOKING_DETAIL_SELECT,
    });
    const adjustableItems = isLeader
      ? await this.prisma.serviceItem.findMany({
          where: { serviceId: booking.serviceId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            unit: true,
            unitPrice: true,
            minutesPerUnit: true,
            minQty: true,
            maxQty: true,
            isRequired: true,
          },
        })
      : [];
    return toStaffBookingDetail(row, staffId, {
      maxAdjustedManMinutes: this.adjustment.maxManMinutes(
        booking.originalManMinutes,
      ),
      adjustableItems,
    });
  }

  /** S02: gỡ riêng người từ chối, đơn về PENDING để admin bổ sung người. */
  async decline(
    staffId: number,
    id: number,
    dto: DeclineBookingDto,
  ): Promise<void> {
    const { booking } = await this.findMembership(staffId, id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new UnprocessableEntityException(
        'Chỉ từ chối được đơn đã xác nhận, chưa bắt đầu',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await transitionBooking(tx, {
        booking,
        to: BookingStatus.PENDING,
        action: BookingAction.DECLINE,
        changedBy: staffId,
        note: dto.reason,
      });
      await tx.bookingAssignment.delete({
        where: { bookingId_staffId: { bookingId: id, staffId } },
      });
    });
  }

  /** S03: trưởng nhóm check-in trong cửa sổ thời gian quanh giờ bắt đầu. */
  async checkIn(staffId: number, id: number): Promise<void> {
    const { booking } = await this.findMembership(staffId, id, true);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new UnprocessableEntityException(
        'Chỉ check-in được đơn đã xác nhận',
      );
    }
    assertCheckInWindow(booking.startAt, new Date(), this.timePolicy);
    await this.prisma.$transaction((tx) =>
      transitionBooking(tx, {
        booking,
        to: BookingStatus.IN_PROGRESS,
        action: BookingAction.CHECK_IN,
        changedBy: staffId,
      }),
    );
  }

  /** S04: A01–A05. */
  async proposeAdjustment(
    staffId: number,
    id: number,
    dto: ProposeAdjustmentDto,
  ): Promise<void> {
    const { booking } = await this.findMembership(staffId, id, true);
    await this.adjustment.propose(staffId, booking, dto.items);
  }

  /** S05: hoàn thành khi không còn đề xuất đang chờ. */
  async complete(staffId: number, id: number): Promise<void> {
    const { booking } = await this.findMembership(staffId, id, true);
    assertNoPendingAdjustment(booking.adjustmentStatus);
    await this.prisma.$transaction((tx) =>
      transitionBooking(tx, {
        booking,
        to: BookingStatus.COMPLETED,
        action: BookingAction.COMPLETE,
        // Đề xuất gửi sau lần đọc ở trên làm tăng version → 409.
        changedBy: staffId,
      }),
    );
  }

  /** S06, B03. */
  async confirmPayment(
    staffId: number,
    id: number,
    dto: ConfirmPaymentDto,
  ): Promise<void> {
    const { booking } = await this.findMembership(staffId, id, true);
    await this.prisma.$transaction((tx) =>
      recordPayment(tx, {
        booking,
        method: dto.method,
        changedBy: staffId,
        now: new Date(),
      }),
    );
  }

  /** S07: khách vắng mặt; đơn hủy và tính một lần hủy muộn cho khách. */
  async reportNoShow(staffId: number, id: number): Promise<void> {
    const { booking } = await this.findMembership(staffId, id, true);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new UnprocessableEntityException(
        'Chỉ báo vắng mặt khi chưa check-in',
      );
    }
    const now = new Date();
    assertNoShowAllowed(booking.startAt, now, this.timePolicy);
    await this.prisma.$transaction(async (tx) => {
      await transitionBooking(tx, {
        booking,
        to: BookingStatus.CANCELLED,
        action: BookingAction.CANCEL,
        changedBy: staffId,
        data: {
          cancelReason: CancelReason.CUSTOMER_NO_SHOW,
          cancelledBy: staffId,
          cancelledAt: now,
        },
      });
      await tx.user.update({
        where: { id: booking.customerId },
        data: { lateCancelCount: { increment: 1 } },
      });
    });
  }

  private async findMembership(
    staffId: number,
    id: number,
    requireLeader = false,
  ) {
    const row = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        ...MEMBERSHIP_SELECT,
        assignments: { where: { staffId }, select: { isLeader: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    const { assignments, ...booking } = row;
    const [membership] = assignments;
    if (!membership) {
      throw new ForbiddenException('Bạn không được giao đơn này');
    }
    if (requireLeader && !membership.isLeader) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm được thực hiện thao tác này',
      );
    }
    return { booking, isLeader: membership.isLeader };
  }
}
