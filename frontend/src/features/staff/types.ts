import type {
  AdjustmentStatus,
  BookingDetail,
  BookingStatus,
  PaymentStatus,
} from '@/features/booking/types'
import type { ServiceItem } from '@/features/catalog/types'

export interface StaffBookingSummary {
  id: number
  code: string
  serviceName: string
  addressText: string
  contactName: string
  contactPhone: string
  note: string | null
  startAt: string
  endAt: string
  staffCount: number
  durationMinutes: number
  totalPrice: number
  status: BookingStatus
  paymentStatus: PaymentStatus
  isLeader: boolean
}

export type AdjustableItem = Omit<ServiceItem, 'sortOrder'>

export interface StaffBookingDetail extends Omit<BookingDetail, 'team'> {
  adjustmentStatus: AdjustmentStatus
  isLeader: boolean
  team: { id: number; fullName: string; phone: string; isLeader: boolean }[]
  /** A04: tổng phút công tối đa của một đề xuất. */
  maxAdjustedManMinutes: number
  adjustableItems: AdjustableItem[]
}

export interface ProposedItemInput {
  serviceItemId: number
  proposedQuantity: number
}
