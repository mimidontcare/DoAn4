import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AreasService, resolveWardActive } from './areas.service';

describe('resolveWardActive (Z01)', () => {
  it('có khu vực: theo yêu cầu, không gửi thì giữ trạng thái cũ', () => {
    expect(
      resolveWardActive({ zoneId: 1, requested: true, current: false }),
    ).toBe(true);
    expect(
      resolveWardActive({ zoneId: 1, requested: undefined, current: true }),
    ).toBe(true);
  });

  it('không có khu vực: luôn tắt', () => {
    expect(
      resolveWardActive({ zoneId: null, requested: undefined, current: true }),
    ).toBe(false);
    expect(
      resolveWardActive({ zoneId: null, requested: false, current: true }),
    ).toBe(false);
  });

  it('không có khu vực mà yêu cầu bật → 422', () => {
    expect(() =>
      resolveWardActive({ zoneId: null, requested: true, current: false }),
    ).toThrow(UnprocessableEntityException);
  });
});

describe('AreasService', () => {
  let service: AreasService;
  let prisma: {
    $transaction: jest.Mock;
    province: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    serviceZone: { findUnique: jest.Mock; findMany: jest.Mock };
    ward: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      province: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 2, isActive: true }),
      },
      serviceZone: { findUnique: jest.fn(), findMany: jest.fn() },
      ward: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    };
    service = new AreasService(prisma as unknown as PrismaService);
  });

  describe('getServiceAreas', () => {
    it('chưa có tỉnh hoạt động → rỗng', async () => {
      prisma.province.findFirst.mockResolvedValue(null);
      await expect(service.getServiceAreas()).resolves.toEqual({
        province: null,
        zones: [],
      });
      expect(prisma.serviceZone.findMany).not.toHaveBeenCalled();
    });
  });

  describe('activateProvince (Z02)', () => {
    it('tắt các tỉnh khác và bật tỉnh này trong một transaction', async () => {
      prisma.province.findUnique.mockResolvedValue({ id: 2 });
      await service.activateProvince(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.province.updateMany).toHaveBeenCalledWith({
        where: { id: { not: 2 }, isActive: true },
        data: { isActive: false },
      });
      expect(prisma.province.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: { isActive: true },
        }),
      );
    });

    it('tỉnh không tồn tại → 404', async () => {
      prisma.province.findUnique.mockResolvedValue(null);
      await expect(service.activateProvince(9)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateWard', () => {
    const ward = { provinceId: 1, zoneId: null, isActive: false };

    it('gán vào khu vực của tỉnh khác → 422', async () => {
      prisma.ward.findUnique.mockResolvedValue(ward);
      prisma.serviceZone.findUnique.mockResolvedValue({ provinceId: 2 });
      await expect(
        service.updateWard(5, { zoneId: 3, isActive: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.ward.update).not.toHaveBeenCalled();
    });

    it('bật phường chưa có khu vực → 422', async () => {
      prisma.ward.findUnique.mockResolvedValue(ward);
      await expect(
        service.updateWard(5, { isActive: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('gỡ khỏi khu vực → phường bị tắt theo', async () => {
      prisma.ward.findUnique.mockResolvedValue({
        provinceId: 1,
        zoneId: 3,
        isActive: true,
      });
      await service.updateWard(5, { zoneId: null });
      expect(prisma.ward.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { zoneId: null, isActive: false } }),
      );
    });

    it('gán khu vực cùng tỉnh và bật', async () => {
      prisma.ward.findUnique.mockResolvedValue(ward);
      prisma.serviceZone.findUnique.mockResolvedValue({ provinceId: 1 });
      await service.updateWard(5, { zoneId: 3, isActive: true });
      expect(prisma.ward.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { zoneId: 3, isActive: true } }),
      );
    });
  });
});
