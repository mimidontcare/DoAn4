import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidRange, StaffService } from './staff.service';

describe('assertValidRange', () => {
  it('kết thúc ≤ bắt đầu → 422', () => {
    const t = new Date('2026-11-02T01:00:00Z');
    expect(() => assertValidRange(t, t)).toThrow(UnprocessableEntityException);
    expect(() => assertValidRange(t, new Date('2026-11-02T00:00:00Z'))).toThrow(
      UnprocessableEntityException,
    );
    expect(() =>
      assertValidRange(t, new Date('2026-11-02T02:00:00Z')),
    ).not.toThrow();
  });
});

describe('StaffService', () => {
  let service: StaffService;
  let prisma: {
    user: { findFirst: jest.Mock; create: jest.Mock };
    serviceZone: { count: jest.Mock };
    staffZone: { deleteMany: jest.Mock; createMany: jest.Mock };
    staffUnavailability: {
      findFirst: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 5, staffZones: [] }),
        create: jest.fn().mockResolvedValue({ id: 5, staffZones: [] }),
      },
      serviceZone: { count: jest.fn() },
      staffZone: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
      },
      staffUnavailability: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const config = { getOrThrow: () => 4 } as unknown as ConfigService;
    service = new StaffService(prisma as unknown as PrismaService, config);
  });

  it('tạo nhân viên: role STAFF, bắt đổi mật khẩu, không lưu mật khẩu gốc', async () => {
    await service.create({
      fullName: 'Trần B',
      email: 'b@example.com',
      phone: '0987654321',
      password: 'matkhautam1',
    });
    const data = (
      prisma.user.create.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data).toMatchObject({
      role: UserRole.STAFF,
      mustChangePassword: true,
    });
    expect(data.passwordHash).not.toBe('matkhautam1');
    expect(data).not.toHaveProperty('password');
  });

  it('id không phải STAFF → 404', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.get(1)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, role: UserRole.STAFF } }),
    );
  });

  describe('setZones', () => {
    it('có khu vực không tồn tại → 422, không xóa khu vực cũ', async () => {
      prisma.serviceZone.count.mockResolvedValue(1);
      await expect(service.setZones(5, [1, 2])).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.staffZone.deleteMany).not.toHaveBeenCalled();
    });

    it('thay toàn bộ: xóa cũ và tạo mới trong một transaction', async () => {
      prisma.serviceZone.count.mockResolvedValue(2);
      await service.setZones(5, [1, 2]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.staffZone.createMany).toHaveBeenCalledWith({
        data: [
          { staffId: 5, zoneId: 1 },
          { staffId: 5, zoneId: 2 },
        ],
      });
    });
  });

  describe('lịch nghỉ', () => {
    const range = {
      startAt: '2026-11-02T01:00:00Z',
      endAt: '2026-11-02T10:00:00Z',
    };

    it('chồng lên lịch nghỉ khác → 409', async () => {
      prisma.staffUnavailability.findFirst.mockResolvedValue({ id: 3 });
      await expect(
        service.createUnavailability(5, 1, range),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.staffUnavailability.create).not.toHaveBeenCalled();
    });

    it('kiểm tra chồng giờ theo điều kiện start < end mới và end > start mới', async () => {
      await service.createUnavailability(5, 1, range);
      expect(prisma.staffUnavailability.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            staffId: 5,
            startAt: { lt: new Date(range.endAt) },
            endAt: { gt: new Date(range.startAt) },
          },
        }),
      );
    });

    it('xóa lịch nghỉ của nhân viên khác → 404', async () => {
      prisma.staffUnavailability.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.deleteUnavailability(5, 9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
