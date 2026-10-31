import { Prisma } from '@prisma/client';

export const BOOKING_SUMMARY_SELECT = {
  id: true,
  code: true,
  serviceName: true,
  addressText: true,
  startAt: true,
  endAt: true,
  staffCount: true,
  durationMinutes: true,
  totalPrice: true,
  status: true,
  paymentStatus: true,
  createdAt: true,
} satisfies Prisma.BookingSelect;

export type BookingSummaryView = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SUMMARY_SELECT;
}>;

const BOOKING_CORE_SELECT = {
  ...BOOKING_SUMMARY_SELECT,
  serviceId: true,
  contactName: true,
  contactPhone: true,
  manMinutes: true,
  itemsTotal: true,
  subtotal: true,
  surcharge: true,
  adjustmentStatus: true,
  note: true,
  cancelReason: true,
  cancelNote: true,
  cancelledAt: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      serviceItemId: true,
      nameSnapshot: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      amount: true,
    },
  },
  histories: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      action: true,
      note: true,
      createdAt: true,
    },
  },
} satisfies Prisma.BookingSelect;

const TEAM_ORDER = [
  { isLeader: 'desc' },
  { staffId: 'asc' },
] satisfies Prisma.BookingAssignmentOrderByWithRelationInput[];

export const BOOKING_DETAIL_SELECT = {
  ...BOOKING_CORE_SELECT,
  assignments: {
    orderBy: TEAM_ORDER,
    select: { isLeader: true, staff: { select: { fullName: true } } },
  },
} satisfies Prisma.BookingSelect;

type BookingDetailRow = Prisma.BookingGetPayload<{
  select: typeof BOOKING_DETAIL_SELECT;
}>;

/** Khách chỉ thấy tên và vai trò trong nhóm, không thấy liên hệ của nhân viên. */
export type BookingDetailView = Omit<BookingDetailRow, 'assignments'> & {
  team: { fullName: string; isLeader: boolean }[];
};

export function toBookingDetail(row: BookingDetailRow): BookingDetailView {
  const { assignments, ...rest } = row;
  return {
    ...rest,
    team: assignments.map((a) => ({
      fullName: a.staff.fullName,
      isLeader: a.isLeader,
    })),
  };
}

export const ADMIN_BOOKING_SUMMARY_SELECT = {
  ...BOOKING_SUMMARY_SELECT,
  customer: { select: { id: true, fullName: true, phone: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.BookingSelect;

type AdminBookingSummaryRow = Prisma.BookingGetPayload<{
  select: typeof ADMIN_BOOKING_SUMMARY_SELECT;
}>;

export type AdminBookingSummaryView = Omit<AdminBookingSummaryRow, '_count'> & {
  assignedCount: number;
};

export function toAdminBookingSummary(
  row: AdminBookingSummaryRow,
): AdminBookingSummaryView {
  const { _count, ...rest } = row;
  return { ...rest, assignedCount: _count.assignments };
}

export const ADMIN_BOOKING_DETAIL_SELECT = {
  ...BOOKING_CORE_SELECT,
  version: true,
  zone: { select: { id: true, name: true } },
  customer: {
    select: { id: true, fullName: true, phone: true, lateCancelCount: true },
  },
  assignments: {
    orderBy: TEAM_ORDER,
    select: {
      isLeader: true,
      staff: { select: { id: true, fullName: true, phone: true } },
    },
  },
} satisfies Prisma.BookingSelect;

type AdminBookingDetailRow = Prisma.BookingGetPayload<{
  select: typeof ADMIN_BOOKING_DETAIL_SELECT;
}>;

export type AdminBookingDetailView = Omit<
  AdminBookingDetailRow,
  'assignments'
> & {
  team: { id: number; fullName: string; phone: string; isLeader: boolean }[];
};

export function toAdminBookingDetail(
  row: AdminBookingDetailRow,
): AdminBookingDetailView {
  const { assignments, ...rest } = row;
  return {
    ...rest,
    team: assignments.map((a) => ({ ...a.staff, isLeader: a.isLeader })),
  };
}
