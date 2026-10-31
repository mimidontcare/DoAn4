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

export const BOOKING_DETAIL_SELECT = {
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

export type BookingDetailView = Prisma.BookingGetPayload<{
  select: typeof BOOKING_DETAIL_SELECT;
}>;
