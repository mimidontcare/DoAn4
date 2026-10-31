import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { toZoned } from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { BUSY_STATUSES } from './staff-schedule';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

interface Interval {
  startAt: Date;
  endAt: Date;
}

interface ZoneLoad {
  staffIds: number[];
  unavailabilities: (Interval & { staffId: number })[];
  pendingBookings: (Interval & { staffCount: number })[];
  assignedBookings: (Interval & { staffId: number })[];
}

type Db = Prisma.TransactionClient;

/**
 * T01–T05, T07: giờ bắt đầu hợp lệ và còn đủ nhân viên rảnh trong khu vực.
 * Đây là kiểm tra mềm; bảo đảm cứng nằm ở bước phân công (T06).
 */
@Injectable()
export class AvailabilityService {
  private readonly tz: string;
  private readonly openMinute: number;
  private readonly closeMinute: number;
  private readonly stepMinutes: number;
  private readonly minLeadMinutes: number;
  private readonly maxAdvanceDays: number;
  private readonly bufferMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<string>('timezone');
    this.openMinute =
      config.getOrThrow<number>('booking.serviceOpenHour') * MINUTES_PER_HOUR;
    this.closeMinute =
      config.getOrThrow<number>('booking.serviceCloseHour') * MINUTES_PER_HOUR;
    this.stepMinutes = config.getOrThrow<number>('booking.slotStepMinutes');
    this.minLeadMinutes =
      config.getOrThrow<number>('booking.minLeadHours') * MINUTES_PER_HOUR;
    this.maxAdvanceDays = config.getOrThrow<number>('booking.maxAdvanceDays');
    this.bufferMs =
      config.getOrThrow<number>('booking.staffBufferMinutes') * MS_PER_MINUTE;
  }

  /** Các giờ bắt đầu còn đủ người trong một ngày (YYYY-MM-DD theo múi giờ nghiệp vụ). */
  async listStartTimes(
    zoneId: number,
    date: string,
    staffCount: number,
    durationMinutes: number,
    now: Date = new Date(),
  ): Promise<Date[]> {
    const candidates = this.candidateStarts(date, durationMinutes, now);
    if (candidates.length === 0) return [];

    const load = await this.loadZone(
      this.prisma,
      zoneId,
      candidates[0],
      this.endOf(candidates[candidates.length - 1], durationMinutes),
    );
    return candidates.filter(
      (start) =>
        this.freeStaffCount(load, start, this.endOf(start, durationMinutes)) >=
        staffCount,
    );
  }

  /** Kiểm tra lại một giờ khi tạo đơn; chạy trong transaction của người gọi. */
  async isSlotAvailable(
    db: Db,
    zoneId: number,
    startAt: Date,
    staffCount: number,
    durationMinutes: number,
  ): Promise<boolean> {
    const endAt = this.endOf(startAt, durationMinutes);
    const load = await this.loadZone(db, zoneId, startAt, endAt);
    return this.freeStaffCount(load, startAt, endAt) >= staffCount;
  }

  /** T01, T02, T07. Vi phạm → 422. */
  assertStartTimeAllowed(
    startAt: Date,
    durationMinutes: number,
    now: Date = new Date(),
  ): void {
    const zoned = toZoned(startAt, this.tz);
    const minuteOfDay = zoned.hour() * MINUTES_PER_HOUR + zoned.minute();
    if (
      zoned.second() !== 0 ||
      zoned.millisecond() !== 0 ||
      (minuteOfDay - this.openMinute) % this.stepMinutes !== 0
    ) {
      throw new UnprocessableEntityException(
        `Giờ bắt đầu phải theo bước ${this.stepMinutes} phút`,
      );
    }
    if (
      minuteOfDay < this.openMinute ||
      minuteOfDay + durationMinutes > this.closeMinute
    ) {
      throw new UnprocessableEntityException(
        'Thời gian làm việc phải nằm trong giờ phục vụ',
      );
    }
    if (!this.isWithinBookingWindow(startAt, now)) {
      throw new UnprocessableEntityException(
        `Chỉ đặt trước tối thiểu ${this.minLeadMinutes / MINUTES_PER_HOUR} giờ, tối đa ${this.maxAdvanceDays} ngày`,
      );
    }
  }

  endOf(startAt: Date, durationMinutes: number): Date {
    return new Date(startAt.getTime() + durationMinutes * MS_PER_MINUTE);
  }

  private candidateStarts(
    date: string,
    durationMinutes: number,
    now: Date,
  ): Date[] {
    const dayStart = dayjs.tz(date, this.tz);
    const starts: Date[] = [];
    for (
      let minute = this.openMinute;
      minute + durationMinutes <= this.closeMinute;
      minute += this.stepMinutes
    ) {
      const start = dayStart.add(minute, 'minute').toDate();
      if (this.isWithinBookingWindow(start, now)) starts.push(start);
    }
    return starts;
  }

  private isWithinBookingWindow(startAt: Date, now: Date): boolean {
    const earliest = now.getTime() + this.minLeadMinutes * MS_PER_MINUTE;
    const latest = dayjs(now).add(this.maxAdvanceDays, 'day').valueOf();
    return startAt.getTime() >= earliest && startAt.getTime() <= latest;
  }

  private async loadZone(
    db: Db,
    zoneId: number,
    from: Date,
    to: Date,
  ): Promise<ZoneLoad> {
    const staff = await db.user.findMany({
      where: {
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        staffZones: { some: { zoneId } },
      },
      select: { id: true },
    });
    const staffIds = staff.map((s) => s.id);

    const unavailabilities = await db.staffUnavailability.findMany({
      where: {
        staffId: { in: staffIds },
        startAt: { lt: to },
        endAt: { gt: from },
      },
      select: { staffId: true, startAt: true, endAt: true },
    });
    const pendingBookings = await db.booking.findMany({
      where: {
        zoneId,
        status: BookingStatus.PENDING,
        startAt: { lt: new Date(to.getTime() + this.bufferMs) },
        endAt: { gt: new Date(from.getTime() - this.bufferMs) },
      },
      select: { startAt: true, endAt: true, staffCount: true },
    });
    const assignments = await db.bookingAssignment.findMany({
      where: {
        staffId: { in: staffIds },
        booking: {
          status: { in: BUSY_STATUSES },
          startAt: { lt: new Date(to.getTime() + this.bufferMs) },
          endAt: { gt: new Date(from.getTime() - this.bufferMs) },
        },
      },
      select: {
        staffId: true,
        booking: { select: { startAt: true, endAt: true } },
      },
    });
    const assignedBookings = assignments.map((a) => ({
      staffId: a.staffId,
      ...a.booking,
    }));
    return { staffIds, unavailabilities, pendingBookings, assignedBookings };
  }

  /** T04, T05: nhân viên không nghỉ, không vướng đơn đã giao, trừ số người các đơn PENDING chồng giờ (tính buffer). */
  private freeStaffCount(load: ZoneLoad, start: Date, end: Date): number {
    const overlapsWithBuffer = (b: Interval) =>
      b.startAt.getTime() < end.getTime() + this.bufferMs &&
      b.endAt.getTime() + this.bufferMs > start.getTime();

    const unavailable = new Set([
      ...load.unavailabilities
        .filter((u) => u.startAt < end && u.endAt > start)
        .map((u) => u.staffId),
      ...load.assignedBookings.filter(overlapsWithBuffer).map((b) => b.staffId),
    ]);
    const reserved = load.pendingBookings
      .filter(overlapsWithBuffer)
      .reduce((sum, b) => sum + b.staffCount, 0);
    return load.staffIds.length - unavailable.size - reserved;
  }
}
