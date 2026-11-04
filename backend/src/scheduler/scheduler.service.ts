import {
  HttpException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BookingAction, BookingStatus, CancelReason } from '@prisma/client';
import { transitionBooking } from '../bookings/booking-state';
import { PrismaService } from '../prisma/prisma.service';

const AUTO_CANCEL_JOB = 'auto-cancel-unstaffed-bookings';
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
export const AUTO_CANCEL_NOTE =
  'Hệ thống tự hủy: chưa đủ nhân viên trước giờ bắt đầu';

/**
 * System (mục 2): job định kỳ tự hủy đơn PENDING (chưa đủ người) khi đã sát giờ
 * bắt đầu, lý do NO_STAFF_AVAILABLE (mục 3.2).
 */
@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly enabled: boolean;
  private readonly beforeMs: number;
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SchedulerRegistry,
    config: ConfigService,
  ) {
    this.enabled = config.getOrThrow<boolean>('scheduler.enabled');
    this.beforeMs =
      config.getOrThrow<number>('scheduler.autoCancelBeforeHours') *
      MS_PER_HOUR;
    this.intervalMs =
      config.getOrThrow<number>('scheduler.autoCancelIntervalMinutes') *
      MS_PER_MINUTE;
  }

  /** Khoảng chạy lấy từ cấu hình nên đăng ký động, không dùng decorator cố định. */
  onModuleInit(): void {
    if (!this.enabled) return;
    const timer = setInterval(() => {
      this.autoCancelUnstaffed().catch((error: unknown) =>
        this.logger.error(
          'Job tự hủy lỗi',
          error instanceof Error ? error.stack : undefined,
        ),
      );
    }, this.intervalMs);
    this.registry.addInterval(AUTO_CANCEL_JOB, timer);
  }

  /** Trả về số đơn đã hủy. Mỗi đơn một transaction; đơn vừa đổi ở nơi khác thì bỏ qua. */
  async autoCancelUnstaffed(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        startAt: { lt: new Date(now.getTime() + this.beforeMs) },
      },
      select: { id: true, status: true, version: true },
    });
    let cancelled = 0;
    for (const booking of due) {
      try {
        await this.prisma.$transaction((tx) =>
          transitionBooking(tx, {
            booking,
            to: BookingStatus.CANCELLED,
            action: BookingAction.CANCEL,
            changedBy: null,
            note: AUTO_CANCEL_NOTE,
            data: {
              cancelReason: CancelReason.NO_STAFF_AVAILABLE,
              cancelNote: AUTO_CANCEL_NOTE,
              cancelledAt: now,
            },
          }),
        );
        cancelled += 1;
      } catch (error) {
        // 409/422: đơn vừa được phân công hoặc hủy ở nơi khác.
        if (!(error instanceof HttpException)) throw error;
      }
    }
    if (cancelled > 0) {
      this.logger.log(`Tự hủy ${cancelled} đơn chưa đủ nhân viên`);
    }
    return cancelled;
  }
}
