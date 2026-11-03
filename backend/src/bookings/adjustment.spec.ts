import { UnprocessableEntityException } from '@nestjs/common';
import { PricingUnit } from '@prisma/client';
import {
  BookedLine,
  buildProposal,
  CatalogItem,
  maxAdjustedManMinutes,
} from './adjustment';

const catalog: CatalogItem[] = [
  {
    id: 1,
    name: 'Sàn',
    unit: PricingUnit.M2,
    unitPrice: 15_000,
    minutesPerUnit: 2,
    minQty: 20,
    maxQty: 2000,
    isRequired: true,
    isActive: true,
  },
  {
    id: 2,
    name: 'Sofa',
    unit: PricingUnit.UNIT,
    unitPrice: 350_000,
    minutesPerUnit: 60,
    minQty: 0,
    maxQty: 5,
    isRequired: false,
    isActive: true,
  },
  {
    id: 3,
    name: 'Rèm (đã tắt)',
    unit: PricingUnit.UNIT,
    unitPrice: 100_000,
    minutesPerUnit: 30,
    minQty: 0,
    maxQty: 5,
    isRequired: false,
    isActive: false,
  },
];
// 100 m² = 200 phút + 1 sofa = 60 phút → 260 phút công lúc đặt.
const booked: BookedLine[] = [
  { id: 10, serviceItemId: 1, quantity: 100, minutesPerUnit: 2 },
  { id: 11, serviceItemId: 2, quantity: 1, minutesPerUnit: 60 },
];
const MAX = maxAdjustedManMinutes(260, 30); // 338

const propose = (
  items: { serviceItemId: number; proposedQuantity: number }[],
) => buildProposal(booked, catalog, items, MAX);

describe('maxAdjustedManMinutes (A04)', () => {
  it('tăng tối đa 30% phút công lúc đặt, làm tròn xuống', () => {
    expect(MAX).toBe(338);
    expect(maxAdjustedManMinutes(100, 30)).toBe(130);
    expect(maxAdjustedManMinutes(100, 0)).toBe(100);
  });
});

describe('buildProposal', () => {
  it('hạng mục không gửi giữ nguyên; mọi dòng đều có proposedQuantity', () => {
    const result = propose([{ serviceItemId: 1, proposedQuantity: 120 }]);
    expect(result.updates).toEqual([
      { id: 10, proposedQuantity: 120 },
      { id: 11, proposedQuantity: 1 },
    ]);
    expect(result.additions).toEqual([]);
    expect(result.manMinutes).toBe(300);
  });

  it('A04: đúng mức tối đa được, vượt 1 phút → 422', () => {
    // 139 m² = 278 + 60 = 338
    expect(
      propose([{ serviceItemId: 1, proposedQuantity: 139 }]).manMinutes,
    ).toBe(338);
    expect(() =>
      propose([{ serviceItemId: 1, proposedQuantity: 140 }]),
    ).toThrow(/Vượt mức tăng tối đa/);
  });

  it('A02: thêm hạng mục chưa đặt, lấy giá hiện tại của catalog', () => {
    const result = propose([{ serviceItemId: 2, proposedQuantity: 2 }]);
    expect(result.manMinutes).toBe(320);
    const withNew = buildProposal(
      [booked[0]],
      catalog,
      [{ serviceItemId: 2, proposedQuantity: 1 }],
      MAX,
    );
    expect(withNew.additions).toEqual([
      {
        serviceItemId: 2,
        nameSnapshot: 'Sofa',
        unit: 'UNIT',
        unitPrice: 350_000,
        minutesPerUnit: 60,
        proposedQuantity: 1,
      },
    ]);
  });

  it('A02: hạng mục ngoài dịch vụ hoặc đã tắt → 422', () => {
    expect(() => propose([{ serviceItemId: 99, proposedQuantity: 1 }])).toThrow(
      /không thuộc dịch vụ/,
    );
    expect(() => propose([{ serviceItemId: 3, proposedQuantity: 1 }])).toThrow(
      UnprocessableEntityException,
    );
  });

  it('cho phép giảm; bỏ hạng mục không bắt buộc bằng 0', () => {
    const result = propose([
      { serviceItemId: 1, proposedQuantity: 50 },
      { serviceItemId: 2, proposedQuantity: 0 },
    ]);
    expect(result.manMinutes).toBe(100);
  });

  it('Q01: ngoài min/max hoặc bỏ hạng mục bắt buộc → 422', () => {
    expect(() => propose([{ serviceItemId: 1, proposedQuantity: 10 }])).toThrow(
      /từ 20 đến 2000/,
    );
    expect(() => propose([{ serviceItemId: 2, proposedQuantity: 6 }])).toThrow(
      /từ 0 đến 5/,
    );
    expect(() => propose([{ serviceItemId: 1, proposedQuantity: 0 }])).toThrow(
      /bắt buộc/,
    );
  });

  it('không thay đổi gì → 422', () => {
    expect(() =>
      propose([{ serviceItemId: 1, proposedQuantity: 100 }]),
    ).toThrow(/không thay đổi/);
    // Gửi 0 cho hạng mục chưa đặt cũng không phải thay đổi.
    expect(() =>
      buildProposal(
        booked,
        catalog,
        [{ serviceItemId: 3, proposedQuantity: 0 }],
        MAX,
      ),
    ).toThrow(UnprocessableEntityException);
  });
});
