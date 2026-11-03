import type { PricingUnit } from '@/features/catalog/types'

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type PaymentStatus = 'UNPAID' | 'PAID'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER'
export type AdjustmentStatus = 'NONE' | 'PENDING' | 'ACCEPTED' | 'REJECTED'

/** Đề xuất điều chỉnh đang chờ khách xác nhận; giá do server tính. */
export interface Proposal {
  lines: {
    serviceItemId: number
    name: string
    unit: PricingUnit
    unitPrice: number
    quantity: number
    proposedQuantity: number
    amount: number
  }[]
  itemsTotal: number
  subtotal: number
  surcharge: number
  total: number
  manMinutes: number
}
export type BookingAction =
  | 'CREATE'
  | 'ASSIGN'
  | 'DECLINE'
  | 'CHECK_IN'
  | 'ADJUST'
  | 'COMPLETE'
  | 'PAYMENT'
  | 'CANCEL'
  | 'RESCHEDULE'
export type CancelReason =
  | 'CUSTOMER_REQUEST'
  | 'CUSTOMER_NO_SHOW'
  | 'NO_STAFF_AVAILABLE'
  | 'ADMIN_DECISION'
  | 'OTHER'

export interface BookingItemInput {
  serviceItemId: number
  quantity: number
}

export interface QuoteInput {
  serviceId: number
  addressId: number
  items: BookingItemInput[]
  date: string
}

export interface Quote {
  lines: {
    serviceItemId: number
    name: string
    unit: PricingUnit
    unitPrice: number
    quantity: number
    amount: number
  }[]
  itemsTotal: number
  subtotal: number
  surcharge: number
  total: number
  manMinutes: number
  staffCount: number
  durationMinutes: number
  availableStartTimes: string[]
}

export interface CreateBookingInput {
  serviceId: number
  addressId: number
  items: BookingItemInput[]
  startAt: string
  /** Tổng tiền đã báo cho khách; lệch với giá hiện tại thì server trả 409. */
  expectedTotal: number
  note?: string
}

export interface BookingSummary {
  id: number
  code: string
  serviceName: string
  addressText: string
  startAt: string
  endAt: string
  staffCount: number
  durationMinutes: number
  totalPrice: number
  status: BookingStatus
  paymentStatus: PaymentStatus
  createdAt: string
}

export interface BookingDetail extends BookingSummary {
  serviceId: number
  contactName: string
  contactPhone: string
  manMinutes: number
  itemsTotal: number
  subtotal: number
  surcharge: number
  note: string | null
  cancelReason: CancelReason | null
  cancelNote: string | null
  cancelledAt: string | null
  adjustmentStatus: AdjustmentStatus
  proposal: Proposal | null
  paymentMethod: PaymentMethod | null
  paidAt: string | null
  team: { fullName: string; isLeader: boolean }[]
  items: {
    id: number
    serviceItemId: number
    nameSnapshot: string
    unit: PricingUnit
    unitPrice: number
    quantity: number
    amount: number
  }[]
  histories: {
    id: number
    fromStatus: BookingStatus | null
    toStatus: BookingStatus
    action: BookingAction
    note: string | null
    createdAt: string
  }[]
}

export interface BookingListQuery {
  status?: BookingStatus
  page: number
}

export interface BookingPage {
  items: BookingSummary[]
  total: number
  page: number
  pageSize: number
}
