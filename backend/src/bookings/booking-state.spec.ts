import { ConflictException } from '@nestjs/common';
import { BookingAction, BookingStatus, Prisma } from '@prisma/client';
import {
  assessCustomerCancel,
  canTransition,
  transitionBooking,
} from './booking-state';

const { PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED } = BookingStatus;
const ALLOWED: [BookingStatus, BookingStatus][] = [
  [PENDING, CONFIRMED],
  [PENDING, CANCELLED],
  [CONFIRMED, PENDING],
  [CONFIRMED, IN_PROGRESS],
  [CONFIRMED, CANCELLED],
  [IN_PROGRESS, COMPLETED],
];

describe('canTransition', () => {
  it('chỉ cho phép đúng các cặp trong bảng chuyển trạng thái', () => {
    const statuses = Object.values(BookingStatus);
    for (const from of statuses) {
      for (const to of statuses) {
        const expected = ALLOWED.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });
});

describe('transitionBooking', () => {
  function tx(count: number) {
    return {
      booking: { updateMany: jest.fn().mockResolvedValue({ count }) },
      bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
  }
  const input = {
    booking: { id: 5, status: PENDING, version: 2 },
    to: CANCELLED,
    action: BookingAction.CANCEL,
    changedBy: 9,
  };
  const client = (mock: ReturnType<typeof tx>) =>
    mock as unknown as Prisma.TransactionClient;

  it('cập nhật kèm version và ghi lịch sử', async () => {
    const mock = tx(1);
    await transitionBooking(client(mock), { ...input, note: 'x' });
    expect(mock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: PENDING, version: 2 },
      data: { status: CANCELLED, version: { increment: 1 } },
    });
    expect(mock.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: {
        bookingId: 5,
        fromStatus: PENDING,
        toStatus: CANCELLED,
        action: BookingAction.CANCEL,
        changedBy: 9,
        note: 'x',
      },
    });
  });

  it('B01: trạng thái cuối → 422, không ghi gì', async () => {
    const mock = tx(1);
    await expect(
      transitionBooking(client(mock), {
        ...input,
        booking: { id: 5, status: COMPLETED, version: 2 },
      }),
    ).rejects.toThrow(/Không thể chuyển/);
    expect(mock.booking.updateMany).not.toHaveBeenCalled();
  });

  it('version đã đổi → 409, không ghi lịch sử', async () => {
    const mock = tx(0);
    await expect(transitionBooking(client(mock), input)).rejects.toThrow(
      ConflictException,
    );
    expect(mock.bookingStatusHistory.create).not.toHaveBeenCalled();
  });
});

describe('assessCustomerCancel', () => {
  const policy = { minHoursBeforeStart: 2, lateCancelHours: 12 };
  const now = new Date('2026-11-02T00:00:00.000Z');
  const hoursLater = (hours: number) =>
    new Date(now.getTime() + hours * 3_600_000);
  const assess = (status: BookingStatus, hours: number) =>
    assessCustomerCancel({ status, startAt: hoursLater(hours) }, now, policy);

  it('PENDING hủy tự do, kể cả sát giờ', () => {
    expect(assess(PENDING, 0.5)).toEqual({ isLate: false });
  });

  it('CONFIRMED còn đúng 12 giờ: chưa tính hủy muộn', () => {
    expect(assess(CONFIRMED, 12)).toEqual({ isLate: false });
  });

  it('CONFIRMED trong vòng 12 giờ: tính hủy muộn', () => {
    expect(assess(CONFIRMED, 11.9)).toEqual({ isLate: true });
  });

  it('CONFIRMED còn đúng 2 giờ: vẫn hủy được', () => {
    expect(assess(CONFIRMED, 2)).toEqual({ isLate: true });
  });

  it('CONFIRMED còn dưới 2 giờ → 422', () => {
    expect(() => assess(CONFIRMED, 1.9)).toThrow(/ít nhất 2 giờ/);
  });

  it.each([IN_PROGRESS, COMPLETED, CANCELLED])(
    '%s không hủy được',
    (status) => {
      expect(() => assess(status, 24)).toThrow(/không thể hủy/);
    },
  );
});
