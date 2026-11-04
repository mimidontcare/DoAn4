import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingAction, BookingStatus, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { completedAtOf } from '../bookings/booking-state';
import type { Paginated } from '../common/dto/pagination.dto';
import { roundRating } from '../common/utils/rating';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListAdminReviewsQueryDto } from './dto/list-admin-reviews-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export interface ReviewView {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface PublicReviewView extends ReviewView {
  /** Tên rút gọn để không lộ họ tên đầy đủ của khách. */
  customerName: string;
}

export interface ServiceReviews extends Paginated<PublicReviewView> {
  average: number | null;
}

const ADMIN_REVIEW_SELECT = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  isHidden: true,
  booking: { select: { id: true, code: true, serviceName: true } },
  customer: { select: { id: true, fullName: true } },
} satisfies Prisma.ReviewSelect;

export type AdminReviewView = Prisma.ReviewGetPayload<{
  select: typeof ADMIN_REVIEW_SELECT;
}>;

/** "Nguyễn Văn An" → "Nguyễn V. A." */
export function shortenName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return [first, ...rest.map((part) => `${part[0]}.`)].join(' ');
}

/** V01–V03: khách đánh giá đơn đã hoàn thành; admin ẩn đánh giá. */
@Injectable()
export class ReviewsService {
  private readonly windowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.windowDays = config.getOrThrow<number>('review.windowDays');
  }

  /** V01: khách của đơn COMPLETED; mỗi đơn 1 lần; trong số ngày cấu hình; không sửa. */
  async create(
    customerId: number,
    bookingId: number,
    dto: CreateReviewDto,
    now: Date = new Date(),
  ): Promise<ReviewView> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        customerId: true,
        status: true,
        review: { select: { id: true } },
        histories: {
          where: { action: BookingAction.COMPLETE },
          orderBy: { id: 'asc' },
          select: { action: true, createdAt: true },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền với đơn này');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new UnprocessableEntityException(
        'Chỉ đánh giá được đơn đã hoàn thành',
      );
    }
    if (booking.review) {
      throw new ConflictException('Đơn này đã được đánh giá');
    }
    const completedAt = completedAtOf(booking.histories);
    if (
      !completedAt ||
      dayjs(now).isAfter(dayjs(completedAt).add(this.windowDays, 'day'))
    ) {
      throw new UnprocessableEntityException(
        `Chỉ đánh giá trong ${this.windowDays} ngày sau khi hoàn thành`,
      );
    }
    try {
      return await this.prisma.review.create({
        data: {
          bookingId,
          customerId,
          rating: dto.rating,
          comment: dto.comment || null,
        },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });
    } catch (error) {
      // Hai request đánh giá cùng lúc: ràng buộc unique booking_id chặn bản thứ hai.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Đơn này đã được đánh giá');
      }
      throw error;
    }
  }

  /** Trang dịch vụ công khai: chỉ đánh giá không bị ẩn (V03). */
  async listForService(
    serviceId: number,
    query: PaginationQueryDto,
  ): Promise<ServiceReviews> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }
    const where: Prisma.ReviewWhereInput = {
      isHidden: false,
      booking: { serviceId },
    };
    const [rows, stats] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          customer: { select: { fullName: true } },
        },
      }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
    ]);
    return {
      items: rows.map(({ customer, ...rest }) => ({
        ...rest,
        customerName: shortenName(customer.fullName),
      })),
      total: stats._count,
      average: roundRating(stats._avg.rating),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async listForAdmin(
    query: ListAdminReviewsQueryDto,
  ): Promise<Paginated<AdminReviewView>> {
    const where: Prisma.ReviewWhereInput = { isHidden: query.hidden };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ADMIN_REVIEW_SELECT,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** V03: ẩn hoặc hiện lại; không xóa. */
  async setHidden(id: number, isHidden: boolean): Promise<AdminReviewView> {
    const { count } = await this.prisma.review.updateMany({
      where: { id },
      data: { isHidden },
    });
    if (count === 0) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    return this.prisma.review.findUniqueOrThrow({
      where: { id },
      select: ADMIN_REVIEW_SELECT,
    });
  }
}
