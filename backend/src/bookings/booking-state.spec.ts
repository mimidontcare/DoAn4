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
import {
  assertCheckInWindow,
  assertNoPendingAdjustment,
  assertNoShowAllowed,
  assessCustomerCancel,
  canTransition,
  recordPayment,
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

describe('mốc thời gian của nhân viên', () => {
  const policy = {
    checkInEarlyMinutes: 30,
    checkInLateMinutes: 60,
    noShowAfterMinutes: 30,
  };
  const startAt = new Date('2026-11-02T02:00:00.000Z');
  const minutesAfter = (m: number) => new Date(startAt.getTime() + m * 60_000);

  it('check-in: đúng biên 30 phút trước và 60 phút sau đều được', () => {
    expect(() =>
      assertCheckInWindow(startAt, minutesAfter(-30), policy),
    ).not.toThrow();
    expect(() =>
      assertCheckInWindow(startAt, minutesAfter(60), policy),
    ).not.toThrow();
  });

  it('check-in: sớm hơn hoặc muộn hơn cửa sổ → 422', () => {
    expect(() =>
      assertCheckInWindow(startAt, minutesAfter(-31), policy),
    ).toThrow(/30 phút trước/);
    expect(() =>
      assertCheckInWindow(startAt, minutesAfter(61), policy),
    ).toThrow(/60 phút sau/);
  });

  it('S07: báo vắng mặt từ đúng 30 phút sau giờ bắt đầu', () => {
    expect(() =>
      assertNoShowAllowed(startAt, minutesAfter(29), policy),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      assertNoShowAllowed(startAt, minutesAfter(30), policy),
    ).not.toThrow();
  });

  it('S05: còn đề xuất đang chờ thì không hoàn thành được', () => {
    expect(() => assertNoPendingAdjustment(AdjustmentStatus.PENDING)).toThrow(
      /đang chờ/,
    );
    for (const status of [
      AdjustmentStatus.NONE,
      AdjustmentStatus.ACCEPTED,
      AdjustmentStatus.REJECTED,
    ]) {
      expect(() => assertNoPendingAdjustment(status)).not.toThrow();
    }
  });
});

describe('recordPayment (B03)', () => {
  const updateMany = jest.fn();
  function tx(count = 1) {
    updateMany.mockReset().mockResolvedValue({ count });
    return {
      booking: { updateMany },
      bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as Prisma.TransactionClient;
  }
  const now = new Date('2026-11-02T05:00:00.000Z');
  const completed = {
    id: 1,
    status: COMPLETED,
    version: 4,
    paymentStatus: PaymentStatus.UNPAID,
  };

  it('UNPAID → PAID kèm phương thức, người xác nhận, điều kiện version', async () => {
    const client = tx();
    await recordPayment(client, {
      booking: completed,
      method: PaymentMethod.CASH,
      changedBy: 7,
      now,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        paymentStatus: 'UNPAID',
        id: 1,
        status: 'COMPLETED',
        version: 4,
      },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        paidAt: now,
        paidConfirmedBy: 7,
        version: { increment: 1 },
      },
    });
  });

  it('chưa hoàn thành hoặc đã thanh toán → 422', async () => {
    await expect(
      recordPayment(tx(), {
        booking: { ...completed, status: IN_PROGRESS },
        method: PaymentMethod.CASH,
        changedBy: 7,
        now,
      }),
    ).rejects.toThrow(/đã hoàn thành/);
    await expect(
      recordPayment(tx(), {
        booking: { ...completed, paymentStatus: PaymentStatus.PAID },
        method: PaymentMethod.CASH,
        changedBy: 7,
        now,
      }),
    ).rejects.toThrow(/đã được thanh toán/);
  });

  it('thu tiền đồng thời: lần sau không khớp version → 409', async () => {
    await expect(
      recordPayment(tx(0), {
        booking: completed,
        method: PaymentMethod.BANK_TRANSFER,
        changedBy: 7,
        now,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
