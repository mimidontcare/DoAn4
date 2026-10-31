import { BookingStatus, Prisma } from '@prisma/client';

/** Trạng thái mà nhóm đã được giao đang giữ lịch của nhân viên (mục 7). */
export const BUSY_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
];

/**
 * Sau khi chờ được khóa, các truy vấn thường phải thấy dữ liệu vừa commit:
 * ở REPEATABLE READ mặc định, snapshot cũ có thể che mất phân công của request
 * vừa giữ khóa và để lọt trùng lịch.
 */
export const STAFF_LOCK_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

/** T06: khóa dòng nhân viên theo id tăng dần để không deadlock. Luôn là bước đầu của transaction. */
export async function lockStaffRows(
  tx: Prisma.TransactionClient,
  staffIds: number[],
): Promise<void> {
  const ascending = [...new Set(staffIds)].sort((a, b) => a - b);
  for (const id of ascending) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
  }
}

interface BusyOptions {
  bufferMs?: number;
  /** Bỏ qua đơn này khi thay nhóm của chính nó. */
  excludeBookingId?: number;
}

/** Nhân viên có booking đã giao chồng lên khoảng thời gian (tính buffer nếu có). */
export async function findBusyStaffIds(
  db: Prisma.TransactionClient,
  staffIds: number[],
  from: Date,
  to: Date,
  { bufferMs = 0, excludeBookingId }: BusyOptions = {},
): Promise<Set<number>> {
  const rows = await db.bookingAssignment.findMany({
    where: {
      staffId: { in: staffIds },
      bookingId: { not: excludeBookingId },
      booking: {
        status: { in: BUSY_STATUSES },
        startAt: { lt: new Date(to.getTime() + bufferMs) },
        endAt: { gt: new Date(from.getTime() - bufferMs) },
      },
    },
    select: { staffId: true },
  });
  return new Set(rows.map((row) => row.staffId));
}

/** Nhân viên có lịch nghỉ chồng lên khoảng thời gian. */
export async function findOnLeaveStaffIds(
  db: Prisma.TransactionClient,
  staffIds: number[],
  from: Date,
  to: Date,
): Promise<Set<number>> {
  const rows = await db.staffUnavailability.findMany({
    where: {
      staffId: { in: staffIds },
      startAt: { lt: to },
      endAt: { gt: from },
    },
    select: { staffId: true },
  });
  return new Set(rows.map((row) => row.staffId));
}
