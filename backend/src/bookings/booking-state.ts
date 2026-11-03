import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AdjustmentStatus,
  BookingAction,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;
export const VERSION_CONFLICT = 'Đơn vừa được cập nhật, vui lòng tải lại';

/** Bảng chuyển trạng thái (master plan mục 4, phần B). B01: COMPLETED, CANCELLED là trạng thái cuối. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  CONFIRMED: [
    BookingStatus.PENDING,
    BookingStatus.IN_PROGRESS,
    BookingStatus.CANCELLED,
  ],
  IN_PROGRESS: [BookingStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

interface HistoryEntry {
  bookingId: number;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  action: BookingAction;
  changedBy: number | null;
  note?: string | null;
}

/** B02: ghi lịch sử, kể cả khi trạng thái không đổi. */
export async function recordBookingHistory(
  tx: Prisma.TransactionClient,
  entry: HistoryEntry,
): Promise<void> {
  await tx.bookingStatusHistory.create({ data: entry });
}

interface TransitionInput {
  booking: { id: number; status: BookingStatus; version: number };
  to: BookingStatus;
  action: BookingAction;
  changedBy: number | null;
  note?: string | null;
  /** Các cột khác đổi cùng lần chuyển (vd thông tin hủy). */
  data?: Prisma.BookingUncheckedUpdateManyInput;
}

/**
 * Hàm duy nhất được đổi status của booking: kiểm tra bảng chuyển trạng thái,
 * cập nhật kèm điều kiện version, ghi lịch sử. Phải chạy trong transaction.
 */
export async function transitionBooking(
  tx: Prisma.TransactionClient,
  input: TransitionInput,
): Promise<void> {
  const { booking, to, action, changedBy, note, data } = input;
  if (!canTransition(booking.status, to)) {
    throw new UnprocessableEntityException(
      `Không thể chuyển đơn từ ${booking.status} sang ${to}`,
    );
  }
  const { count } = await tx.booking.updateMany({
    where: {
      id: booking.id,
      status: booking.status,
      version: booking.version,
    },
    data: { ...data, status: to, version: { increment: 1 } },
  });
  if (count === 0) {
    throw new ConflictException(VERSION_CONFLICT);
  }
  await recordBookingHistory(tx, {
    bookingId: booking.id,
    fromStatus: booking.status,
    toStatus: to,
    action,
    changedBy,
    note,
  });
}

export interface CancelPolicy {
  /** Còn ít hơn số giờ này trước giờ bắt đầu thì không hủy được. */
  minHoursBeforeStart: number;
  /** Còn ít hơn số giờ này thì tính một lần hủy muộn. */
  lateCancelHours: number;
}

/**
 * C01–C03, khách hủy: PENDING hủy tự do; CONFIRMED phải còn đủ giờ.
 * Trả về có tính hủy muộn hay không.
 */
export function assessCustomerCancel(
  booking: { status: BookingStatus; startAt: Date },
  now: Date,
  policy: CancelPolicy,
): { isLate: boolean } {
  if (booking.status === BookingStatus.PENDING) {
    return { isLate: false };
  }
  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new UnprocessableEntityException(
      'Đơn ở trạng thái này không thể hủy',
    );
  }
  const hoursLeft = (booking.startAt.getTime() - now.getTime()) / MS_PER_HOUR;
  if (hoursLeft < policy.minHoursBeforeStart) {
    throw new UnprocessableEntityException(
      `Chỉ hủy được khi còn ít nhất ${policy.minHoursBeforeStart} giờ trước giờ bắt đầu`,
    );
  }
  return { isLate: hoursLeft < policy.lateCancelHours };
}

interface VersionedBooking {
  id: number;
  status: BookingStatus;
  version: number;
}

/**
 * Thay đổi không đổi status (điều chỉnh, thu tiền): vẫn kèm điều kiện status và
 * version để không ghi đè thay đổi đồng thời, rồi ghi lịch sử (B02).
 */
export async function updateBookingInPlace(
  tx: Prisma.TransactionClient,
  input: {
    booking: VersionedBooking;
    action: BookingAction;
    changedBy: number;
    note?: string | null;
    where?: Prisma.BookingWhereInput;
    data: Prisma.BookingUncheckedUpdateManyInput;
  },
): Promise<void> {
  const { booking, action, changedBy, note, where, data } = input;
  const { count } = await tx.booking.updateMany({
    where: {
      ...where,
      id: booking.id,
      status: booking.status,
      version: booking.version,
    },
    data: { ...data, version: { increment: 1 } },
  });
  if (count === 0) {
    throw new ConflictException(VERSION_CONFLICT);
  }
  await recordBookingHistory(tx, {
    bookingId: booking.id,
    fromStatus: booking.status,
    toStatus: booking.status,
    action,
    changedBy,
    note,
  });
}

/** B03, S06: UNPAID → PAID, chỉ khi COMPLETED. */
export async function recordPayment(
  tx: Prisma.TransactionClient,
  input: {
    booking: VersionedBooking & { paymentStatus: PaymentStatus };
    method: PaymentMethod;
    changedBy: number;
    now: Date;
  },
): Promise<void> {
  const { booking, method, changedBy, now } = input;
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new UnprocessableEntityException(
      'Chỉ xác nhận thu tiền khi đơn đã hoàn thành',
    );
  }
  if (booking.paymentStatus === PaymentStatus.PAID) {
    throw new UnprocessableEntityException('Đơn đã được thanh toán');
  }
  await updateBookingInPlace(tx, {
    booking,
    action: BookingAction.PAYMENT,
    changedBy,
    where: { paymentStatus: PaymentStatus.UNPAID },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: method,
      paidAt: now,
      paidConfirmedBy: changedBy,
    },
  });
}

export interface StaffTimePolicy {
  checkInEarlyMinutes: number;
  checkInLateMinutes: number;
  noShowAfterMinutes: number;
}

const minutesFrom = (startAt: Date, now: Date) =>
  (now.getTime() - startAt.getTime()) / MS_PER_MINUTE;

/** Phần B: check-in từ trước đến sau giờ bắt đầu theo cấu hình. */
export function assertCheckInWindow(
  startAt: Date,
  now: Date,
  policy: StaffTimePolicy,
): void {
  const offset = minutesFrom(startAt, now);
  if (offset < -policy.checkInEarlyMinutes) {
    throw new UnprocessableEntityException(
      `Chỉ check-in từ ${policy.checkInEarlyMinutes} phút trước giờ bắt đầu`,
    );
  }
  if (offset > policy.checkInLateMinutes) {
    throw new UnprocessableEntityException(
      `Đã quá ${policy.checkInLateMinutes} phút sau giờ bắt đầu, liên hệ quản trị`,
    );
  }
}

/** S07: chỉ báo khách vắng mặt sau giờ bắt đầu theo cấu hình. */
export function assertNoShowAllowed(
  startAt: Date,
  now: Date,
  policy: StaffTimePolicy,
): void {
  if (minutesFrom(startAt, now) < policy.noShowAfterMinutes) {
    throw new UnprocessableEntityException(
      `Chỉ báo vắng mặt sau giờ bắt đầu ${policy.noShowAfterMinutes} phút`,
    );
  }
}

/** S05: không hoàn thành khi còn đề xuất điều chỉnh đang chờ. */
export function assertNoPendingAdjustment(
  adjustmentStatus: AdjustmentStatus,
): void {
  if (adjustmentStatus === AdjustmentStatus.PENDING) {
    throw new UnprocessableEntityException(
      'Còn đề xuất điều chỉnh đang chờ khách xác nhận',
    );
  }
}
