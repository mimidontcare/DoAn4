import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentService } from './assignment.service';
import { BookingsService } from './bookings.service';

const startAt = new Date(Date.now() + 86_400_000);
const booking = {
  id: 1,
  status: BookingStatus.PENDING,
  version: 3,
  staffCount: 2,
  zoneId: 7,
  startAt,
  endAt: new Date(startAt.getTime() + 7_200_000),
};
const dto = { staffIds: [5, 2], leaderId: 5, version: 3 };

function setup(overrides: Partial<typeof booking> = {}) {
  const calls: string[] = [];
  const tx = {
    $queryRaw: jest.fn((_: TemplateStringsArray, id: number) => {
      calls.push(`lock:${id}`);
      return Promise.resolve([]);
    }),
    booking: {
      findUnique: jest.fn(() => {
        calls.push('read');
        return Promise.resolve({ ...booking, ...overrides });
      }),
      updateMany: jest.fn(() => {
        calls.push('update');
        return Promise.resolve({ count: 1 });
      }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 5 }, { id: 2 }]),
    },
    staffUnavailability: { findMany: jest.fn().mockResolvedValue([]) },
    bookingAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    bookingStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const bookings = { getForAdmin: jest.fn().mockResolvedValue({ id: 1 }) };
  const service = new AssignmentService(
    prisma as unknown as PrismaService,
    bookings as unknown as BookingsService,
    { getOrThrow: () => 30 } as unknown as ConfigService,
  );
  return { tx, prisma, service, calls };
}

describe('AssignmentService.assignTeam', () => {
  it('T06: khóa nhân viên theo id tăng dần trước mọi truy vấn khác', async () => {
    const { service, calls } = setup();
    await service.assignTeam(9, 1, dto);
    expect(calls).toEqual(['lock:2', 'lock:5', 'read', 'update']);
  });

  it('chạy READ COMMITTED để thấy phân công vừa commit sau khi chờ khóa', async () => {
    const { service, prisma } = setup();
    await service.assignTeam(9, 1, dto);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
  });

  it('PENDING → CONFIRMED, Q04 đúng 1 trưởng nhóm, ghi lịch sử', async () => {
    const { service, tx } = setup();
    await service.assignTeam(9, 1, dto);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PENDING', version: 3 },
      data: { status: 'CONFIRMED', version: { increment: 1 } },
    });
    expect(tx.bookingAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { bookingId: 1, staffId: 5, isLeader: true, assignedBy: 9 },
        { bookingId: 1, staffId: 2, isLeader: false, assignedBy: 9 },
      ],
    });
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
        action: 'ASSIGN',
      }) as object,
    });
  });

  it('CONFIRMED: thay nhóm giữ trạng thái, vẫn tăng version và ghi lịch sử', async () => {
    const { service, tx } = setup({ status: BookingStatus.CONFIRMED });
    await service.assignTeam(9, 1, dto);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'CONFIRMED', version: 3 },
      data: { version: { increment: 1 } },
    });
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: 'CONFIRMED',
        toStatus: 'CONFIRMED',
      }) as object,
    });
  });

  it('kiểm tra trùng lịch bỏ qua chính đơn này và tính buffer', async () => {
    const { service, tx } = setup();
    await service.assignTeam(9, 1, dto);
    expect(tx.bookingAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingId: { not: 1 },
          booking: {
            status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            startAt: { lt: new Date(booking.endAt.getTime() + 1_800_000) },
            endAt: { gt: new Date(booking.startAt.getTime() - 1_800_000) },
          },
        }) as object,
      }),
    );
  });

  it('sai version → 409, không ghi gì', async () => {
    const { service, tx } = setup({ version: 4 });
    await expect(service.assignTeam(9, 1, dto)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('version đổi lúc cập nhật → 409, chưa đụng tới nhóm cũ', async () => {
    const { service, tx } = setup();
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.assignTeam(9, 1, dto)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.bookingAssignment.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ['IN_PROGRESS', { status: BookingStatus.IN_PROGRESS }, /không phân công/],
    ['đã hủy', { status: BookingStatus.CANCELLED }, /không phân công/],
    ['đã qua giờ', { startAt: new Date(Date.now() - 1000) }, /qua giờ/],
    ['sai số người', { staffCount: 3 }, /đúng 3 nhân viên/],
  ])('%s → 422', async (_name, overrides, message) => {
    const { service } = setup(overrides);
    const error = await service.assignTeam(9, 1, dto).catch((e: Error) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as Error).message).toMatch(message);
  });

  it('trưởng nhóm ngoài nhóm → 422', async () => {
    const { service } = setup();
    await expect(
      service.assignTeam(9, 1, { ...dto, leaderId: 8 }),
    ).rejects.toThrow(/Trưởng nhóm/);
  });

  it('nhân viên bị khóa hoặc sai khu vực → 422', async () => {
    const { service, tx } = setup();
    tx.user.findMany.mockResolvedValue([{ id: 5 }]);
    await expect(service.assignTeam(9, 1, dto)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('đang nghỉ hoặc trùng lịch → 409', async () => {
    const leave = setup();
    leave.tx.staffUnavailability.findMany.mockResolvedValue([{ staffId: 5 }]);
    await expect(leave.service.assignTeam(9, 1, dto)).rejects.toThrow(
      /đang nghỉ/,
    );
    const busy = setup();
    busy.tx.bookingAssignment.findMany.mockResolvedValue([{ staffId: 2 }]);
    await expect(busy.service.assignTeam(9, 1, dto)).rejects.toThrow(
      /trùng lịch/,
    );
  });
});
