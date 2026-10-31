import {
  ConflictException,
  Injectable,
  NotFoundException,
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
import { PrismaService } from '../prisma/prisma.service';
import { recordBookingHistory, transitionBooking } from './booking-state';
import { BookingsService } from './bookings.service';
import type { AdminBookingDetailView } from './booking.select';
import { AssignTeamDto } from './dto/assign-team.dto';
import {
  findBusyStaffIds,
  findOnLeaveStaffIds,
  lockStaffRows,
  STAFF_LOCK_TX_OPTIONS,
} from './staff-schedule';

const MS_PER_MINUTE = 60_000;
const VERSION_CONFLICT = 'Đơn vừa được cập nhật, vui lòng tải lại';

export interface AvailableStaffView {
  id: number;
  fullName: string;
  phone: string;
  /** Đang thuộc nhóm của đơn này. */
  isCurrentMember: boolean;
}

const BOOKING_SCHEDULE_SELECT = {
  id: true,
  status: true,
  version: true,
  staffCount: true,
  zoneId: true,
  startAt: true,
  endAt: true,
} satisfies Prisma.BookingSelect;

type BookingSchedule = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SCHEDULE_SELECT;
}>;

/** A05, T04, T06, Q04: gợi ý nhân viên rảnh và phân công nhóm chống trùng lịch. */
@Injectable()
export class AssignmentService {
  private readonly bufferMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    config: ConfigService,
  ) {
    this.bufferMs =
      config.getOrThrow<number>('booking.staffBufferMinutes') * MS_PER_MINUTE;
  }

  /** Nhân viên ACTIVE thuộc khu vực của đơn, không nghỉ, không vướng đơn khác. */
  async listAvailableStaff(bookingId: number): Promise<AvailableStaffView[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        ...BOOKING_SCHEDULE_SELECT,
        assignments: { select: { staffId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    const staff = await this.prisma.user.findMany({
      where: {
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        staffZones: { some: { zoneId: booking.zoneId } },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: { id: true, fullName: true, phone: true },
    });
    const { onLeave, busy } = await this.findConflicts(
      this.prisma,
      booking,
      staff.map((s) => s.id),
    );
    const members = new Set(booking.assignments.map((a) => a.staffId));
    return staff
      .filter((s) => !onLeave.has(s.id) && !busy.has(s.id))
      .map((s) => ({ ...s, isCurrentMember: members.has(s.id) }));
  }

  /**
   * T06: thay cả nhóm một lần. PENDING chuyển CONFIRMED; CONFIRMED giữ nguyên
   * trạng thái và ghi lịch sử (thay người, U03).
   * Thứ tự bắt buộc: khóa nhân viên trước mọi truy vấn khác, sau đó mới kiểm tra.
   */
  async assignTeam(
    adminId: number,
    bookingId: number,
    dto: AssignTeamDto,
  ): Promise<AdminBookingDetailView> {
    await this.prisma.$transaction(async (tx) => {
      await lockStaffRows(tx, dto.staffIds);

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: BOOKING_SCHEDULE_SELECT,
      });
      if (!booking) {
        throw new NotFoundException('Không tìm thấy đơn');
      }
      this.assertAssignable(booking, dto);
      await this.assertStaffEligible(tx, booking, dto.staffIds);

      // Cập nhật booking trước khi thay nhóm: hai request cùng đơn xếp hàng tại
      // dòng booking, request sau không còn khớp version → 409.
      await this.markAssigned(tx, booking, adminId);
      await tx.bookingAssignment.deleteMany({ where: { bookingId } });
      await tx.bookingAssignment.createMany({
        data: dto.staffIds.map((staffId) => ({
          bookingId,
          staffId,
          isLeader: staffId === dto.leaderId,
          assignedBy: adminId,
        })),
      });
    }, STAFF_LOCK_TX_OPTIONS);
    return this.bookings.getForAdmin(bookingId);
  }

  private assertAssignable(booking: BookingSchedule, dto: AssignTeamDto) {
    if (booking.version !== dto.version) {
      throw new ConflictException(VERSION_CONFLICT);
    }
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new UnprocessableEntityException(
        'Đơn ở trạng thái này không phân công được',
      );
    }
    if (booking.startAt.getTime() <= Date.now()) {
      throw new UnprocessableEntityException(
        'Đơn đã qua giờ bắt đầu, không phân công được',
      );
    }
    if (dto.staffIds.length !== booking.staffCount) {
      throw new UnprocessableEntityException(
        `Đơn này cần đúng ${booking.staffCount} nhân viên`,
      );
    }
    if (!dto.staffIds.includes(dto.leaderId)) {
      throw new UnprocessableEntityException(
        'Trưởng nhóm phải thuộc nhóm được chọn',
      );
    }
  }

  private async assertStaffEligible(
    tx: Prisma.TransactionClient,
    booking: BookingSchedule,
    staffIds: number[],
  ) {
    const staff = await tx.user.findMany({
      where: {
        id: { in: staffIds },
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        staffZones: { some: { zoneId: booking.zoneId } },
      },
      select: { id: true },
    });
    if (staff.length !== staffIds.length) {
      throw new UnprocessableEntityException(
        'Có nhân viên đã bị khóa hoặc không thuộc khu vực của đơn',
      );
    }
    const { onLeave, busy } = await this.findConflicts(tx, booking, staffIds);
    if (onLeave.size > 0) {
      throw new ConflictException('Có nhân viên đang nghỉ trong giờ này');
    }
    if (busy.size > 0) {
      throw new ConflictException(
        'Có nhân viên bị trùng lịch, chọn người khác',
      );
    }
  }

  private async findConflicts(
    db: Prisma.TransactionClient,
    booking: BookingSchedule,
    staffIds: number[],
  ) {
    const { startAt, endAt, id } = booking;
    const [onLeave, busy] = await Promise.all([
      findOnLeaveStaffIds(db, staffIds, startAt, endAt),
      findBusyStaffIds(db, staffIds, startAt, endAt, {
        bufferMs: this.bufferMs,
        excludeBookingId: id,
      }),
    ]);
    return { onLeave, busy };
  }

  /** B02: mỗi lần đổi nhóm đều ghi lịch sử, kể cả khi trạng thái không đổi. */
  private async markAssigned(
    tx: Prisma.TransactionClient,
    booking: BookingSchedule,
    adminId: number,
  ) {
    if (booking.status === BookingStatus.PENDING) {
      await transitionBooking(tx, {
        booking,
        to: BookingStatus.CONFIRMED,
        action: BookingAction.ASSIGN,
        changedBy: adminId,
      });
      return;
    }
    const { count } = await tx.booking.updateMany({
      where: {
        id: booking.id,
        status: booking.status,
        version: booking.version,
      },
      data: { version: { increment: 1 } },
    });
    if (count === 0) {
      throw new ConflictException(VERSION_CONFLICT);
    }
    await recordBookingHistory(tx, {
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: booking.status,
      action: BookingAction.ASSIGN,
      changedBy: adminId,
    });
  }
}
