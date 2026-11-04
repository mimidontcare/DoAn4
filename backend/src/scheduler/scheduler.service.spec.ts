import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTO_CANCEL_NOTE, SchedulerService } from './scheduler.service';

const CONFIG: Record<string, unknown> = {
  'scheduler.enabled': true,
  'scheduler.autoCancelBeforeHours': 2,
  'scheduler.autoCancelIntervalMinutes': 5,
};

function setup(updateCounts: number[] = []) {
  const updateMany = jest.fn();
  for (const count of updateCounts) {
    updateMany.mockResolvedValueOnce({ count });
  }
  const tx = {
    booking: { updateMany },
    bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    booking: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const registry = { addInterval: jest.fn() };
  const config = (overrides: Record<string, unknown> = {}) =>
    ({
      getOrThrow: (key: string) => ({ ...CONFIG, ...overrides })[key],
    }) as unknown as ConfigService;
  const make = (overrides?: Record<string, unknown>) =>
    new SchedulerService(
      prisma as unknown as PrismaService,
      registry as unknown as SchedulerRegistry,
      config(overrides),
    );
  return { prisma, tx, registry, make };
}

describe('SchedulerService', () => {
  const now = new Date('2026-11-04T01:00:00.000Z');

  it('chỉ lấy đơn PENDING bắt đầu trong vòng 2 giờ tới (kể cả đã qua giờ)', async () => {
    const { prisma, make } = setup();
    prisma.booking.findMany.mockResolvedValue([]);
    await make().autoCancelUnstaffed(now);
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.PENDING,
        startAt: { lt: new Date('2026-11-04T03:00:00.000Z') },
      },
      select: { id: true, status: true, version: true },
    });
  });

  it('hủy với lý do NO_STAFF_AVAILABLE, người thực hiện là hệ thống', async () => {
    const { prisma, tx, make } = setup([1]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 5, status: BookingStatus.PENDING, version: 2 },
    ]);
    expect(await make().autoCancelUnstaffed(now)).toBe(1);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'PENDING', version: 2 },
      data: {
        cancelReason: 'NO_STAFF_AVAILABLE',
        cancelNote: AUTO_CANCEL_NOTE,
        cancelledAt: now,
        status: 'CANCELLED',
        version: { increment: 1 },
      },
    });
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedBy: null,
        toStatus: 'CANCELLED',
      }) as object,
    });
  });

  it('đơn vừa được phân công ở nơi khác (version lệch) thì bỏ qua, chạy tiếp đơn sau', async () => {
    const { prisma, make } = setup([0, 1]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 5, status: BookingStatus.PENDING, version: 2 },
      { id: 6, status: BookingStatus.PENDING, version: 0 },
    ]);
    expect(await make().autoCancelUnstaffed(now)).toBe(1);
  });

  it('chỉ đăng ký job khi được bật', () => {
    const on = setup();
    on.make().onModuleInit();
    expect(on.registry.addInterval).toHaveBeenCalledTimes(1);
    clearInterval(
      (on.registry.addInterval.mock.calls[0] as [string, NodeJS.Timeout])[1],
    );

    const off = setup();
    off.make({ 'scheduler.enabled': false }).onModuleInit();
    expect(off.registry.addInterval).not.toHaveBeenCalled();
  });
});
