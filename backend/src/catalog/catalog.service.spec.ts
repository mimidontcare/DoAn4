import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PricingUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertItemQuantityRules, CatalogService } from './catalog.service';
import { CreateServiceItemDto } from './dto/create-service-item.dto';

describe('assertItemQuantityRules (Q01)', () => {
  it('min ≤ max, không bắt buộc, min = 0: hợp lệ', () => {
    expect(() =>
      assertItemQuantityRules({ minQty: 0, maxQty: 5, isRequired: false }),
    ).not.toThrow();
  });

  it('min > max → 422', () => {
    expect(() =>
      assertItemQuantityRules({ minQty: 6, maxQty: 5, isRequired: false }),
    ).toThrow(UnprocessableEntityException);
  });

  it('bắt buộc mà min = 0 → 422; min ≥ 1 thì hợp lệ', () => {
    expect(() =>
      assertItemQuantityRules({ minQty: 0, maxQty: 5, isRequired: true }),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      assertItemQuantityRules({ minQty: 1, maxQty: 5, isRequired: true }),
    ).not.toThrow();
  });
});

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: {
    service: { findUnique: jest.Mock; create: jest.Mock };
    serviceItem: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  const itemDto: CreateServiceItemDto = {
    name: 'Sofa 3 chỗ',
    unit: PricingUnit.UNIT,
    unitPrice: 350000,
    minutesPerUnit: 90,
    minQty: 0,
    maxQty: 5,
  };

  beforeEach(() => {
    prisma = {
      service: { findUnique: jest.fn(), create: jest.fn() },
      serviceItem: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new CatalogService(prisma as unknown as PrismaService);
  });

  describe('createService', () => {
    it('không gửi slug: tự sinh từ tên', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      prisma.service.create.mockResolvedValue({});
      await service.createService({ name: 'Vệ sinh kính', minCharge: 300000 });
      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 've-sinh-kinh' }) as unknown,
        }),
      );
    });

    it('slug đã có → 409', async () => {
      prisma.service.findUnique.mockResolvedValue({ id: 9 });
      await expect(
        service.createService({ name: 'Vệ sinh kính', minCharge: 0 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('tên không sinh được slug → 422', async () => {
      await expect(
        service.createService({ name: '!!!', minCharge: 0 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('createItem', () => {
    it('dịch vụ không tồn tại → 404', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      await expect(service.createItem(1, itemDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('min > max → 422, không ghi DB', async () => {
      prisma.service.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.createItem(1, { ...itemDto, minQty: 10, maxQty: 5 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.serviceItem.create).not.toHaveBeenCalled();
    });

    it('hợp lệ → tạo gắn với dịch vụ', async () => {
      prisma.service.findUnique.mockResolvedValue({ id: 1 });
      await service.createItem(1, itemDto);
      expect(prisma.serviceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ serviceId: 1 }) as unknown,
        }),
      );
    });
  });

  describe('updateItem', () => {
    it('hạng mục không thuộc dịch vụ trên URL → 404', async () => {
      prisma.serviceItem.findFirst.mockResolvedValue(null);
      await expect(
        service.updateItem(1, 99, { unitPrice: 1000 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.serviceItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 99, serviceId: 1 } }),
      );
    });

    it('chỉ gửi maxQty: kiểm tra với minQty đang lưu', async () => {
      prisma.serviceItem.findFirst.mockResolvedValue({
        minQty: 20,
        maxQty: 500,
        isRequired: true,
      });
      await expect(
        service.updateItem(1, 2, { maxQty: 10 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(prisma.serviceItem.update).not.toHaveBeenCalled();
    });

    it('bật isRequired khi minQty đang là 0 → 422', async () => {
      prisma.serviceItem.findFirst.mockResolvedValue({
        minQty: 0,
        maxQty: 5,
        isRequired: false,
      });
      await expect(
        service.updateItem(1, 2, { isRequired: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });
});
