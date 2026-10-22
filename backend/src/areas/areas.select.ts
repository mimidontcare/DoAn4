import { Prisma } from '@prisma/client';

export const PROVINCE_SELECT = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  _count: { select: { zones: true, wards: true } },
} satisfies Prisma.ProvinceSelect;

export type ProvinceView = Prisma.ProvinceGetPayload<{
  select: typeof PROVINCE_SELECT;
}>;

export const ZONE_SELECT = {
  id: true,
  provinceId: true,
  name: true,
  isActive: true,
  _count: { select: { wards: true } },
} satisfies Prisma.ServiceZoneSelect;

export type ZoneView = Prisma.ServiceZoneGetPayload<{
  select: typeof ZONE_SELECT;
}>;

export const WARD_SELECT = {
  id: true,
  provinceId: true,
  code: true,
  name: true,
  type: true,
  oldNameHint: true,
  isActive: true,
  zone: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.WardSelect;

export type WardView = Prisma.WardGetPayload<{ select: typeof WARD_SELECT }>;

const PUBLIC_WARD_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  oldNameHint: true,
} satisfies Prisma.WardSelect;

export type PublicWard = Prisma.WardGetPayload<{
  select: typeof PUBLIC_WARD_SELECT;
}>;

/** Z01: chỉ phường đang bật, thuộc khu vực đang bật. */
export const PUBLIC_ZONE_SELECT = {
  id: true,
  name: true,
  wards: {
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: PUBLIC_WARD_SELECT,
  },
} satisfies Prisma.ServiceZoneSelect;

/** Đủ field để kiểm tra Z01 và hiển thị tên phường, khu vực, tỉnh. */
export const SERVICEABILITY_SELECT = {
  id: true,
  name: true,
  type: true,
  isActive: true,
  zone: { select: { id: true, name: true, isActive: true } },
  province: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.WardSelect;

export interface ServiceAreas {
  province: { id: number; code: string; name: string } | null;
  zones: { id: number; name: string; wards: PublicWard[] }[];
}
