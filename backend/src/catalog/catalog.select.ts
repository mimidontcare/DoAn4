import { Prisma } from '@prisma/client';

const ITEM_FIELDS = {
  id: true,
  name: true,
  unit: true,
  unitPrice: true,
  minutesPerUnit: true,
  minQty: true,
  maxQty: true,
  isRequired: true,
  sortOrder: true,
} satisfies Prisma.ServiceItemSelect;

const ITEM_ORDER: Prisma.ServiceItemOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { id: 'asc' },
];

export const SERVICE_ORDER: Prisma.ServiceOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { id: 'asc' },
];

const SERVICE_FIELDS = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  minCharge: true,
  sortOrder: true,
} satisfies Prisma.ServiceSelect;

/** C05: khách chỉ thấy hạng mục đang hoạt động. */
export const PUBLIC_SERVICE_SELECT = {
  ...SERVICE_FIELDS,
  items: {
    where: { isActive: true },
    orderBy: ITEM_ORDER,
    select: ITEM_FIELDS,
  },
} satisfies Prisma.ServiceSelect;

export type PublicService = Prisma.ServiceGetPayload<{
  select: typeof PUBLIC_SERVICE_SELECT;
}>;

export const ADMIN_ITEM_SELECT = {
  ...ITEM_FIELDS,
  isActive: true,
  updatedAt: true,
} satisfies Prisma.ServiceItemSelect;

export type AdminServiceItem = Prisma.ServiceItemGetPayload<{
  select: typeof ADMIN_ITEM_SELECT;
}>;

export const ADMIN_SERVICE_SUMMARY_SELECT = {
  ...SERVICE_FIELDS,
  isActive: true,
  updatedAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.ServiceSelect;

export type AdminServiceSummary = Prisma.ServiceGetPayload<{
  select: typeof ADMIN_SERVICE_SUMMARY_SELECT;
}>;

export const ADMIN_SERVICE_SELECT = {
  ...SERVICE_FIELDS,
  isActive: true,
  updatedAt: true,
  items: { orderBy: ITEM_ORDER, select: ADMIN_ITEM_SELECT },
} satisfies Prisma.ServiceSelect;

export type AdminService = Prisma.ServiceGetPayload<{
  select: typeof ADMIN_SERVICE_SELECT;
}>;
