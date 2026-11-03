import { AdjustmentStatus, Prisma, PricingUnit } from '@prisma/client';
import { totalsOf, Totals } from './pricing.service';

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
  originalManMinutes: true,
  minCharge: true,
  paymentMethod: true,
  paidAt: true,
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
      minutesPerUnit: true,
      quantity: true,
      proposedQuantity: true,
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
export type BookingDetailView = Omit<
  BookingDetailRow,
  'assignments' | 'items'
> &
  WithProposal & {
    team: { fullName: string; isLeader: boolean }[];
  };

export function toBookingDetail(row: BookingDetailRow): BookingDetailView {
  const { assignments, ...rest } = row;
  return {
    ...withProposal(rest),
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
  'assignments' | 'items'
> &
  WithProposal & {
    team: { id: number; fullName: string; phone: string; isLeader: boolean }[];
  };

export function toAdminBookingDetail(
  row: AdminBookingDetailRow,
): AdminBookingDetailView {
  const { assignments, ...rest } = row;
  return {
    ...withProposal(rest),
    team: assignments.map((a) => ({ ...a.staff, isLeader: a.isLeader })),
  };
}

export const STAFF_BOOKING_SUMMARY_SELECT = {
  ...BOOKING_SUMMARY_SELECT,
  contactName: true,
  contactPhone: true,
  note: true,
} satisfies Prisma.BookingSelect;

export type StaffBookingSummaryView = Prisma.BookingGetPayload<{
  select: typeof STAFF_BOOKING_SUMMARY_SELECT;
}> & { isLeader: boolean };

/** Nhân viên thấy liên hệ của khách và đồng đội trong đơn mình được giao (mục 15). */
export const STAFF_BOOKING_DETAIL_SELECT = {
  ...BOOKING_CORE_SELECT,
  assignments: {
    orderBy: TEAM_ORDER,
    select: {
      isLeader: true,
      staff: { select: { id: true, fullName: true, phone: true } },
    },
  },
} satisfies Prisma.BookingSelect;

export type StaffBookingDetailRow = Prisma.BookingGetPayload<{
  select: typeof STAFF_BOOKING_DETAIL_SELECT;
}>;

export interface AdjustableItem {
  id: number;
  name: string;
  unit: PricingUnit;
  unitPrice: number;
  minutesPerUnit: number;
  minQty: number;
  maxQty: number;
  isRequired: boolean;
}

export type StaffBookingDetailView = Omit<
  StaffBookingDetailRow,
  'assignments' | 'items'
> &
  WithProposal & {
    isLeader: boolean;
    team: { id: number; fullName: string; phone: string; isLeader: boolean }[];
    /** A04: tổng phút công tối đa của một đề xuất. */
    maxAdjustedManMinutes: number;
    /** A02: hạng mục của dịch vụ được dùng khi đề xuất (chỉ trưởng nhóm). */
    adjustableItems: AdjustableItem[];
  };

export function toStaffBookingDetail(
  row: StaffBookingDetailRow,
  staffId: number,
  extra: { maxAdjustedManMinutes: number; adjustableItems: AdjustableItem[] },
): StaffBookingDetailView {
  const { assignments, ...rest } = row;
  const team = assignments.map((a) => ({ ...a.staff, isLeader: a.isLeader }));
  return {
    ...withProposal(rest),
    ...extra,
    team,
    isLeader: team.some((m) => m.id === staffId && m.isLeader),
  };
}

// ---------- Đề xuất điều chỉnh (A01–A05) ----------

type ItemRow = BookingDetailRow['items'][number];

export interface ProposalView extends Totals {
  lines: {
    serviceItemId: number;
    name: string;
    unit: PricingUnit;
    unitPrice: number;
    quantity: number;
    proposedQuantity: number;
    amount: number;
  }[];
}

interface WithProposal {
  /** Chỉ các dòng đang có khối lượng; dòng mới thêm khi đề xuất nằm ở proposal. */
  items: ItemRow[];
  /** Có khi đề xuất đang chờ khách xác nhận. */
  proposal: ProposalView | null;
}

function withProposal<
  T extends {
    items: ItemRow[];
    adjustmentStatus: AdjustmentStatus;
    minCharge: number;
  },
>(row: T): Omit<T, 'items'> & WithProposal {
  const { items } = row;
  const pending = row.adjustmentStatus === AdjustmentStatus.PENDING;
  const lines = pending
    ? items.map((item) => {
        const proposedQuantity = item.proposedQuantity ?? item.quantity;
        return {
          serviceItemId: item.serviceItemId,
          name: item.nameSnapshot,
          unit: item.unit,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          proposedQuantity,
          amount: proposedQuantity * item.unitPrice,
        };
      })
    : [];
  return {
    ...row,
    items: items.filter((item) => item.quantity > 0),
    proposal: pending
      ? {
          lines,
          ...totalsOf(
            items.map((item) => ({
              ...item,
              quantity: item.proposedQuantity ?? item.quantity,
            })),
            row.minCharge,
          ),
        }
      : null,
  };
}
