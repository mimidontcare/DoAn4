import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PricingUnit } from '@prisma/client';
import { PricedServiceItem, PricingService, totalsOf } from './pricing.service';

const floor: PricedServiceItem = {
  id: 1,
  name: 'Sàn',
  unit: PricingUnit.M2,
  unitPrice: 15_000,
  minutesPerUnit: 2,
  minQty: 20,
  maxQty: 2000,
  isRequired: true,
};
const sofa: PricedServiceItem = {
  id: 2,
  name: 'Sofa 3 chỗ',
  unit: PricingUnit.UNIT,
  unitPrice: 350_000,
  minutesPerUnit: 90,
  minQty: 0,
  maxQty: 5,
  isRequired: false,
};
const service = { minCharge: 500_000, items: [floor, sofa] };

function createService(maxStaffPerBooking = 4) {
  const values: Record<string, number | string> = {
    'booking.manMinutesPerStaff': 240,
    'booking.maxStaffPerBooking': maxStaffPerBooking,
    'booking.slotStepMinutes': 30,
    'booking.weekendSurchargePercent': 10,
    timezone: 'Asia/Ho_Chi_Minh',
  };
  return new PricingService({
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService);
}

describe('PricingService', () => {
  const pricing = createService();

  it('tính đúng ví dụ mục 3.3', () => {
    const result = pricing.calculate(service, [
      { serviceItemId: 1, quantity: 200 },
      { serviceItemId: 2, quantity: 1 },
    ]);
    expect(result).toMatchObject({
      itemsTotal: 3_350_000,
      subtotal: 3_350_000,
      surcharge: 0,
      total: 3_350_000,
      manMinutes: 490,
      staffCount: 3,
      durationMinutes: 180,
    });
    expect(result.lines[1]).toMatchObject({
      name: 'Sofa 3 chỗ',
      amount: 350_000,
    });
  });

  it('P04: áp dụng min_charge khi tổng hạng mục thấp hơn', () => {
    const result = pricing.calculate(service, [
      { serviceItemId: 1, quantity: 20 },
    ]);
    expect(result).toMatchObject({
      itemsTotal: 300_000,
      subtotal: 500_000,
      total: 500_000,
    });
  });

  it('làm tròn tổng về 1.000đ gần nhất', () => {
    const cheap = { ...floor, unitPrice: 1_250, minQty: 0 };
    const total = (quantity: number) =>
      createService().calculate({ minCharge: 0, items: [cheap] }, [
        { serviceItemId: 1, quantity },
      ]).total;
    expect(total(1)).toBe(1_000); // 1.250
    expect(total(2)).toBe(3_000); // 2.500
  });

  it('240 phút công còn 1 người, 241 phút thành 2 người', () => {
    const item = { ...floor, minutesPerUnit: 1, minQty: 0 };
    const items = { minCharge: 0, items: [item] };
    expect(
      pricing.calculate(items, [{ serviceItemId: 1, quantity: 240 }]),
    ).toMatchObject({ staffCount: 1, durationMinutes: 240 });
    expect(
      pricing.calculate(items, [{ serviceItemId: 1, quantity: 241 }]),
    ).toMatchObject({ staffCount: 2, durationMinutes: 150 });
  });

  it('hạng mục 0 phút công vẫn chiếm một bước giờ', () => {
    const zero = { ...floor, minutesPerUnit: 0, minQty: 0 };
    expect(
      pricing.calculate({ minCharge: 0, items: [zero] }, [
        { serviceItemId: 1, quantity: 1 },
      ]),
    ).toMatchObject({ staffCount: 1, durationMinutes: 30 });
  });

  it('Q03: vượt MAX_STAFF_PER_BOOKING → 422', () => {
    // 961 m² × 1 phút = 5 người; đúng 960 m² còn 4 người.
    const item = { ...floor, minutesPerUnit: 1, minQty: 0 };
    const items = { minCharge: 0, items: [item] };
    expect(
      pricing.calculate(items, [{ serviceItemId: 1, quantity: 960 }])
        .staffCount,
    ).toBe(4);
    expect(() =>
      pricing.calculate(items, [{ serviceItemId: 1, quantity: 961 }]),
    ).toThrow(/Đơn quá lớn/);
  });

  it('Q03: MAX_STAFF_PER_BOOKING = 1 là phương án an toàn', () => {
    expect(() =>
      createService(1).calculate(service, [
        { serviceItemId: 1, quantity: 121 },
      ]),
    ).toThrow(UnprocessableEntityException);
  });

  it('Q01: số lượng ngoài min/max → 422', () => {
    expect(() =>
      pricing.calculate(service, [{ serviceItemId: 1, quantity: 19 }]),
    ).toThrow(/từ 20 đến 2000/);
    expect(() =>
      pricing.calculate(service, [{ serviceItemId: 1, quantity: 2001 }]),
    ).toThrow(UnprocessableEntityException);
  });

  it('Q01: thiếu hạng mục bắt buộc → 422', () => {
    expect(() =>
      pricing.calculate(service, [{ serviceItemId: 2, quantity: 1 }]),
    ).toThrow(/bắt buộc/);
  });

  it('hạng mục không thuộc dịch vụ hoặc đã tắt → 422', () => {
    expect(() =>
      pricing.calculate(service, [
        { serviceItemId: 1, quantity: 20 },
        { serviceItemId: 99, quantity: 1 },
      ]),
    ).toThrow(/không thuộc dịch vụ/);
  });
});

describe('Phụ phí cuối tuần (P05)', () => {
  const pricing = createService();

  it('thứ Bảy, Chủ nhật theo giờ Việt Nam; ngày thường 0%', () => {
    // 2026-11-07 là thứ Bảy.
    expect(pricing.surchargePercentOn('2026-11-07')).toBe(10);
    expect(pricing.surchargePercentOn('2026-11-08')).toBe(10);
    expect(pricing.surchargePercentOn('2026-11-09')).toBe(0);
    // 23:30 UTC thứ Sáu là 06:30 sáng thứ Bảy giờ Việt Nam.
    expect(
      pricing.surchargePercentAt(new Date('2026-11-06T23:30:00.000Z')),
    ).toBe(10);
  });

  it('tính trên tổng sau min_charge, rồi làm tròn 1.000đ', () => {
    const result = pricing.calculate(
      service,
      [{ serviceItemId: 1, quantity: 20 }],
      10,
    );
    expect(result).toMatchObject({
      subtotal: 500_000,
      surcharge: 50_000,
      total: 550_000,
      surchargePercent: 10,
    });
  });

  it('totalsOf: phụ phí là số nguyên VND', () => {
    const totals = totalsOf(
      [{ quantity: 1, unitPrice: 333_333, minutesPerUnit: 0 }],
      0,
      10,
    );
    expect(totals.surcharge).toBe(33_333);
    expect(totals.total).toBe(367_000);
  });
});
