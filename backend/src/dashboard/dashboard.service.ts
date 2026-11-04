import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdjustmentStatus, BookingStatus, PaymentStatus } from '@prisma/client';
import dayjs from 'dayjs';
// Nạp plugin utc, timezone cho dayjs.
import '../common/utils/time';
import { roundRating } from '../common/utils/rating';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardView {
  /** "YYYY-MM" theo múi giờ nghiệp vụ. */
  month: string;
  statusCounts: Record<BookingStatus, number>;
  /** Doanh thu: tổng tiền các đơn đã thu trong tháng, theo ngày thu tiền. */
  revenue: { total: number; paidCount: number };
  rating: { average: number | null; count: number };
  /** Việc cần admin xử lý. */
  attention: {
    unassigned: number;
    overdueCheckIn: number;
    pendingAdjustments: number;
    unpaid: number;
  };
}

/** A08: dashboard rút gọn. */
@Injectable()
export class DashboardService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<string>('timezone');
  }

  async summary(
    month?: string,
    now: Date = new Date(),
  ): Promise<DashboardView> {
    const start = month
      ? dayjs.tz(`${month}-01`, this.tz)
      : dayjs(now).tz(this.tz).startOf('month');
    const end = start.add(1, 'month');

    const [
      byStatus,
      revenue,
      rating,
      unassigned,
      overdue,
      adjustments,
      unpaid,
    ] = await this.prisma.$transaction([
      this.prisma.booking.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.booking.aggregate({
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: { gte: start.toDate(), lt: end.toDate() },
        },
        _sum: { totalPrice: true },
        _count: true,
      }),
      this.prisma.review.aggregate({
        where: { isHidden: false },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CONFIRMED, startAt: { lt: now } },
      }),
      this.prisma.booking.count({
        where: { adjustmentStatus: AdjustmentStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: {
          status: BookingStatus.COMPLETED,
          paymentStatus: PaymentStatus.UNPAID,
        },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(BookingStatus).map((status) => [status, 0]),
    ) as Record<BookingStatus, number>;
    for (const row of byStatus) {
      const count = row._count as { _all: number };
      statusCounts[row.status] = count._all;
    }
    return {
      month: start.format('YYYY-MM'),
      statusCounts,
      revenue: {
        total: revenue._sum.totalPrice ?? 0,
        paidCount: revenue._count,
      },
      rating: {
        average: roundRating(rating._avg.rating),
        count: rating._count,
      },
      attention: {
        unassigned,
        overdueCheckIn: overdue,
        pendingAdjustments: adjustments,
        unpaid,
      },
    };
  }
}
