import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BookingAction, BookingStatus, Prisma } from '@prisma/client';

const MS_PER_HOUR = 3_600_000;

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
    throw new ConflictException('Đơn vừa được cập nhật, vui lòng tải lại');
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
