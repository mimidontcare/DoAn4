import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WardType } from '@prisma/client';
import { AreasService } from '../areas/areas.service';
import { PrismaService } from '../prisma/prisma.service';
import { toAddressView } from './address.select';
import { AddressesService } from './addresses.service';

const ward = {
  id: 7,
  name: 'Phường Một',
  type: WardType.PHUONG,
  isActive: true,
  zone: { id: 1, name: 'Trung tâm', isActive: true },
  province: { id: 1, name: 'Tỉnh A', isActive: true },
};
const row = {
  id: 1,
  detail: 'Số 1',
  label: null,
  contactName: 'A',
  contactPhone: '0912345678',
  isDefault: true,
  createdAt: new Date(),
  ward,
};
const dto = {
  wardId: 7,
  detail: 'Số 1 ngõ 2',
  contactName: 'Nguyễn Văn A',
  contactPhone: '0912345678',
};

describe('toAddressView', () => {
  it('isServiceable theo Z01: phường, khu vực, tỉnh đều phải bật', () => {
    expect(toAddressView(row).isServiceable).toBe(true);
    expect(
      toAddressView({ ...row, ward: { ...ward, isActive: false } })
        .isServiceable,
    ).toBe(false);
    expect(
      toAddressView({
        ...row,
        ward: { ...ward, zone: { ...ward.zone, isActive: false } },
      }).isServiceable,
    ).toBe(false);
    expect(
      toAddressView({
        ...row,
        ward: { ...ward, province: { ...ward.province, isActive: false } },
      }).isServiceable,
    ).toBe(false);
  });
});

describe('AddressesService', () => {
  let service: AddressesService;
  let tx: {
    address: {
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let prisma: {
    address: { count: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let areas: { assertWardServiceable: jest.Mock };

  beforeEach(() => {
    tx = {
      address: {
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    prisma = {
      address: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(row),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    areas = { assertWardServiceable: jest.fn().mockResolvedValue(ward) };
    const config = {
      getOrThrow: () => 5,
    } as unknown as ConfigService;
    service = new AddressesService(
      prisma as unknown as PrismaService,
      areas as unknown as AreasService,
      config,
    );
  });

  describe('create', () => {
    it('địa chỉ đầu tiên luôn là mặc định', async () => {
      await service.create(1, dto);
      expect(tx.address.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
            isDefault: true,
          }) as unknown,
        }),
      );
    });

    it('đã có địa chỉ, không yêu cầu mặc định → không đụng địa chỉ khác', async () => {
      prisma.address.count.mockResolvedValue(2);
      await service.create(1, dto);
      expect(tx.address.updateMany).not.toHaveBeenCalled();
      expect(tx.address.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: false }) as unknown,
        }),
      );
    });

    it('đủ 5 địa chỉ → 422, không kiểm tra phường, không tạo', async () => {
      prisma.address.count.mockResolvedValue(5);
      await expect(service.create(1, dto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(areas.assertWardServiceable).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('phường ngoài vùng → lỗi của AreasService được giữ nguyên', async () => {
      areas.assertWardServiceable.mockRejectedValue(
        new UnprocessableEntityException(),
      );
      await expect(service.create(1, dto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('chống IDOR', () => {
    it('địa chỉ không thuộc user → 404, truy vấn lọc theo userId', async () => {
      prisma.address.findFirst.mockResolvedValue(null);
      await expect(
        service.update(1, 99, { detail: 'X Y Z' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.address.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99, userId: 1, isDeleted: false },
        }),
      );
    });
  });

  describe('remove', () => {
    it('xóa địa chỉ mặc định → địa chỉ cũ nhất còn lại thành mặc định', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 1, isDefault: true });
      tx.address.findFirst.mockResolvedValue({ id: 2 });
      await service.remove(1, 1);
      expect(tx.address.update).toHaveBeenNthCalledWith(1, {
        where: { id: 1 },
        data: { isDeleted: true, isDefault: false },
      });
      expect(tx.address.update).toHaveBeenNthCalledWith(2, {
        where: { id: 2 },
        data: { isDefault: true },
      });
    });

    it('xóa địa chỉ thường → không đổi mặc định', async () => {
      prisma.address.findFirst.mockResolvedValue({ id: 3, isDefault: false });
      await service.remove(1, 3);
      expect(tx.address.update).toHaveBeenCalledTimes(1);
      expect(tx.address.findFirst).not.toHaveBeenCalled();
    });
  });
});
