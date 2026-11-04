import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingAction, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService, shortenName } from './reviews.service';

const completedAt = new Date('2026-11-01T10:00:00.000Z');
const daysAfter = (days: number) =>
  new Date(completedAt.getTime() + days * 86_400_000);

function setup(booking: object | null) {
  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    review: {
      create: jest.fn().mockResolvedValue({ id: 1, rating: 5 }),
    },
  };
  const service = new ReviewsService(
    prisma as unknown as PrismaService,
    { getOrThrow: () => 7 } as unknown as ConfigService,
  );
  return { prisma, service };
}

const completed = {
  customerId: 3,
  status: BookingStatus.COMPLETED,
  review: null,
  histories: [{ action: BookingAction.COMPLETE, createdAt: completedAt }],
};
const dto = { rating: 5, comment: 'Tốt' };

describe('shortenName', () => {
  it('giữ họ, rút gọn tên đệm và tên', () => {
    expect(shortenName('Nguyễn Văn An')).toBe('Nguyễn V. A.');
    expect(shortenName('  Lan ')).toBe('Lan');
  });
});

describe('ReviewsService.create (V01)', () => {
  it('đơn COMPLETED của chính khách, trong 7 ngày → tạo', async () => {
    const { service, prisma } = setup(completed);
    await service.create(3, 9, dto, daysAfter(6.9));
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { bookingId: 9, customerId: 3, rating: 5, comment: 'Tốt' },
      }),
    );
  });

  it('đúng mốc 7 ngày vẫn được; quá 7 ngày → 422', async () => {
    await expect(
      setup(completed).service.create(3, 9, dto, daysAfter(7)),
    ).resolves.toBeDefined();
    await expect(
      setup(completed).service.create(3, 9, dto, daysAfter(7.01)),
    ).rejects.toThrow(/trong 7 ngày/);
  });

  it('đơn không có → 404; không phải chủ đơn → 403', async () => {
    await expect(setup(null).service.create(3, 9, dto)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      setup(completed).service.create(4, 9, dto, daysAfter(1)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('chưa hoàn thành → 422; đã đánh giá → 409', async () => {
    await expect(
      setup({ ...completed, status: BookingStatus.IN_PROGRESS }).service.create(
        3,
        9,
        dto,
        daysAfter(1),
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(
      setup({ ...completed, review: { id: 1 } }).service.create(
        3,
        9,
        dto,
        daysAfter(1),
      ),
    ).rejects.toThrow(ConflictException);
  });
});
