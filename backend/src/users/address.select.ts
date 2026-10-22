import { Prisma } from '@prisma/client';
import { SERVICEABILITY_SELECT } from '../areas/areas.select';
import { isWardServiceable } from '../areas/areas.service';

export const ADDRESS_SELECT = {
  id: true,
  detail: true,
  label: true,
  contactName: true,
  contactPhone: true,
  isDefault: true,
  createdAt: true,
  ward: { select: SERVICEABILITY_SELECT },
} satisfies Prisma.AddressSelect;

type AddressRow = Prisma.AddressGetPayload<{ select: typeof ADDRESS_SELECT }>;

export interface AddressView {
  id: number;
  detail: string;
  label: string | null;
  contactName: string;
  contactPhone: string;
  isDefault: boolean;
  createdAt: Date;
  ward: {
    id: number;
    name: string;
    type: AddressRow['ward']['type'];
    zoneName: string | null;
    provinceName: string;
  };
  /** Phường có thể bị tắt sau khi lưu; false thì không dùng để đặt lịch được (Z01). */
  isServiceable: boolean;
}

export function toAddressView(row: AddressRow): AddressView {
  const { ward, ...rest } = row;
  return {
    ...rest,
    ward: {
      id: ward.id,
      name: ward.name,
      type: ward.type,
      zoneName: ward.zone?.name ?? null,
      provinceName: ward.province.name,
    },
    isServiceable: isWardServiceable(ward),
  };
}
