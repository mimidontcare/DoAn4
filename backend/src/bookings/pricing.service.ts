import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PricingUnit } from '@prisma/client';
import dayjs from 'dayjs';
import { roundToThousand } from '../common/utils/money';
import { isWeekendInZone } from '../common/utils/time';

export interface PricedServiceItem {
  id: number;
  name: string;
  unit: PricingUnit;
  unitPrice: number;
  minutesPerUnit: number;
  minQty: number;
  maxQty: number;
  isRequired: boolean;
}

export interface PricedService {
  minCharge: number;
  /** Chỉ các hạng mục đang hoạt động. */
  items: PricedServiceItem[];
}

export interface RequestedItem {
  serviceItemId: number;
  quantity: number;
}

export interface PriceLine {
  serviceItemId: number;
  name: string;
  unit: PricingUnit;
  unitPrice: number;
  minutesPerUnit: number;
  quantity: number;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  surchargePercent: number;
  itemsTotal: number;
  subtotal: number;
  surcharge: number;
  total: number;
  manMinutes: number;
  staffCount: number;
  durationMinutes: number;
}

export interface CostLine {
  quantity: number;
  unitPrice: number;
  minutesPerUnit: number;
}

export interface Totals {
  itemsTotal: number;
  subtotal: number;
  surcharge: number;
  total: number;
  manMinutes: number;
}

/** P03–P05: tổng tiền và phút công của các dòng, áp dụng mức tối thiểu và phụ phí. */
export function totalsOf(
  lines: CostLine[],
  minCharge: number,
  surchargePercent = 0,
): Totals {
  const itemsTotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const subtotal = Math.max(itemsTotal, minCharge);
  // Tiền là số nguyên VND (P03).
  const surcharge = Math.round((subtotal * surchargePercent) / 100);
  const manMinutes = lines.reduce(
    (sum, line) => sum + line.quantity * line.minutesPerUnit,
    0,
  );
  return {
    itemsTotal,
    subtotal,
    surcharge,
    total: roundToThousand(subtotal + surcharge),
    manMinutes,
  };
}

/** P01–P04, Q01–Q03: công thức mục 3.3. Giá luôn tính từ bảng giá hiện tại. */
@Injectable()
export class PricingService {
  private readonly manMinutesPerStaff: number;
  private readonly maxStaffPerBooking: number;
  private readonly durationStepMinutes: number;
  private readonly tz: string;
  private readonly weekendSurchargePercent: number;

  constructor(config: ConfigService) {
    this.tz = config.getOrThrow<string>('timezone');
    this.weekendSurchargePercent = config.getOrThrow<number>(
      'booking.weekendSurchargePercent',
    );
    this.manMinutesPerStaff = config.getOrThrow<number>(
      'booking.manMinutesPerStaff',
    );
    this.maxStaffPerBooking = config.getOrThrow<number>(
      'booking.maxStaffPerBooking',
    );
    this.durationStepMinutes = config.getOrThrow<number>(
      'booking.slotStepMinutes',
    );
  }

  /** P05, T07: thứ Bảy, Chủ nhật theo múi giờ nghiệp vụ của thời điểm bắt đầu. */
  surchargePercentAt(startAt: Date): number {
    return isWeekendInZone(startAt, this.tz) ? this.weekendSurchargePercent : 0;
  }

  /** Ngày "YYYY-MM-DD" theo múi giờ nghiệp vụ; lấy giữa trưa để không lệch ngày. */
  surchargePercentOn(date: string): number {
    return this.surchargePercentAt(dayjs.tz(`${date} 12:00`, this.tz).toDate());
  }

  calculate(
    service: PricedService,
    requested: RequestedItem[],
    surchargePercent = 0,
  ): PriceBreakdown {
    const lines = this.buildLines(service, requested);
    const totals = totalsOf(lines, service.minCharge, surchargePercent);
    const { manMinutes } = totals;
    const staffCount = Math.max(
      1,
      Math.ceil(manMinutes / this.manMinutesPerStaff),
    );
    if (staffCount > this.maxStaffPerBooking) {
      throw new UnprocessableEntityException('Đơn quá lớn, vui lòng liên hệ');
    }

    return {
      lines,
      surchargePercent,
      ...totals,
      staffCount,
      durationMinutes: this.durationOf(manMinutes, staffCount),
    };
  }

  /** Hạng mục có thể có 0 phút công; đơn vẫn chiếm tối thiểu một bước giờ. */
  private durationOf(manMinutes: number, staffCount: number): number {
    const step = this.durationStepMinutes;
    const perStaff = Math.ceil(manMinutes / staffCount);
    return Math.max(step, Math.ceil(perStaff / step) * step);
  }

  private buildLines(
    service: PricedService,
    requested: RequestedItem[],
  ): PriceLine[] {
    const itemById = new Map(service.items.map((item) => [item.id, item]));

    const lines = requested.map(({ serviceItemId, quantity }) => {
      const item = itemById.get(serviceItemId);
      if (!item) {
        throw new UnprocessableEntityException(
          'Hạng mục không thuộc dịch vụ hoặc đã ngừng cung cấp',
        );
      }
      if (quantity < item.minQty || quantity > item.maxQty) {
        throw new UnprocessableEntityException(
          `Số lượng "${item.name}" phải từ ${item.minQty} đến ${item.maxQty}`,
        );
      }
      return {
        serviceItemId,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        minutesPerUnit: item.minutesPerUnit,
        quantity,
        amount: quantity * item.unitPrice,
      };
    });

    const requestedIds = new Set(lines.map((line) => line.serviceItemId));
    const missing = service.items.find(
      (item) => item.isRequired && !requestedIds.has(item.id),
    );
    if (missing) {
      throw new UnprocessableEntityException(
        `Hạng mục "${missing.name}" là bắt buộc`,
      );
    }
    return lines;
  }
}
