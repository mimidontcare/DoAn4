import { UnprocessableEntityException } from '@nestjs/common';
import { PricingUnit } from '@prisma/client';

/** Dòng đã đặt của booking; đơn giá và phút công là snapshot (P02). */
export interface BookedLine {
  id: number;
  serviceItemId: number;
  quantity: number;
  minutesPerUnit: number;
}

/** Hạng mục trong catalog của dịch vụ, gồm cả hạng mục đã tắt. */
export interface CatalogItem {
  id: number;
  name: string;
  unit: PricingUnit;
  unitPrice: number;
  minutesPerUnit: number;
  minQty: number;
  maxQty: number;
  isRequired: boolean;
  isActive: boolean;
}

export interface ProposedItem {
  serviceItemId: number;
  proposedQuantity: number;
}

export interface Proposal {
  /** Mọi dòng đã đặt đều có proposedQuantity, kể cả dòng không đổi. */
  updates: { id: number; proposedQuantity: number }[];
  /** Hạng mục chưa đặt, thêm với quantity 0 và giá hiện tại của catalog. */
  additions: (Omit<
    CatalogItem,
    'id' | 'name' | 'minQty' | 'maxQty' | 'isRequired' | 'isActive'
  > & {
    serviceItemId: number;
    nameSnapshot: string;
    proposedQuantity: number;
  })[];
  manMinutes: number;
}

/** A04: tổng phút công tối đa, tính trên phút công lúc đặt. */
export function maxAdjustedManMinutes(
  originalManMinutes: number,
  maxPercent: number,
): number {
  return Math.floor((originalManMinutes * (100 + maxPercent)) / 100);
}

/**
 * A02, A04, Q01: dựng đề xuất từ khối lượng trưởng nhóm nhập.
 * Hạng mục không nhập giữ khối lượng đã đặt; nhập 0 là bỏ hạng mục đó.
 */
export function buildProposal(
  booked: BookedLine[],
  catalog: CatalogItem[],
  requested: ProposedItem[],
  maxManMinutes: number,
): Proposal {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const bookedByItem = new Map(
    booked.map((line) => [line.serviceItemId, line]),
  );
  const requestedByItem = new Map(
    requested.map((r) => [r.serviceItemId, r.proposedQuantity]),
  );

  for (const { serviceItemId } of requested) {
    const item = catalogById.get(serviceItemId);
    if (!bookedByItem.has(serviceItemId) && !item?.isActive) {
      throw new UnprocessableEntityException(
        'Hạng mục không thuộc dịch vụ hoặc đã ngừng cung cấp',
      );
    }
  }

  const updates = booked.map((line) => ({
    id: line.id,
    proposedQuantity: requestedByItem.get(line.serviceItemId) ?? line.quantity,
  }));
  const additions = requested
    .filter((r) => !bookedByItem.has(r.serviceItemId) && r.proposedQuantity > 0)
    .map((r) => {
      const item = catalogById.get(r.serviceItemId)!;
      return {
        serviceItemId: item.id,
        nameSnapshot: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        minutesPerUnit: item.minutesPerUnit,
        proposedQuantity: r.proposedQuantity,
      };
    });

  const finalQuantity = new Map<number, number>([
    ...booked.map(
      (line, i) => [line.serviceItemId, updates[i].proposedQuantity] as const,
    ),
    ...additions.map((a) => [a.serviceItemId, a.proposedQuantity] as const),
  ]);

  for (const [serviceItemId, quantity] of finalQuantity) {
    const item = catalogById.get(serviceItemId);
    if (
      item &&
      quantity > 0 &&
      (quantity < item.minQty || quantity > item.maxQty)
    ) {
      throw new UnprocessableEntityException(
        `Số lượng "${item.name}" phải từ ${item.minQty} đến ${item.maxQty}`,
      );
    }
  }
  const missing = catalog.find(
    (item) =>
      item.isActive && item.isRequired && !(finalQuantity.get(item.id)! > 0),
  );
  if (missing) {
    throw new UnprocessableEntityException(
      `Hạng mục "${missing.name}" là bắt buộc`,
    );
  }
  if (![...finalQuantity.values()].some((quantity) => quantity > 0)) {
    throw new UnprocessableEntityException('Đơn phải còn ít nhất một hạng mục');
  }
  const unchanged =
    additions.length === 0 &&
    booked.every((line, i) => updates[i].proposedQuantity === line.quantity);
  if (unchanged) {
    throw new UnprocessableEntityException('Khối lượng đề xuất không thay đổi');
  }

  const manMinutes =
    booked.reduce(
      (sum, line, i) => sum + updates[i].proposedQuantity * line.minutesPerUnit,
      0,
    ) +
    additions.reduce(
      (sum, a) => sum + a.proposedQuantity * a.minutesPerUnit,
      0,
    );
  if (manMinutes > maxManMinutes) {
    throw new UnprocessableEntityException(
      `Vượt mức tăng tối đa (${maxManMinutes} phút công). Chỉ làm khối lượng đã đặt, phần còn lại đặt đơn mới`,
    );
  }
  return { updates, additions, manMinutes };
}
