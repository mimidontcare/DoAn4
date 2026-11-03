import { apiClient, unwrap, type ApiResponse } from '@/api/client'
import type { PaymentMethod } from '@/features/booking/types'
import type { ProposedItemInput, StaffBookingDetail, StaffBookingSummary } from './types'

export async function fetchSchedule(from: string, to: string): Promise<StaffBookingSummary[]> {
  const res = await apiClient.get<ApiResponse<StaffBookingSummary[]>>('/staff/bookings', {
    params: { from, to },
  })
  return unwrap(res.data)
}

export async function fetchStaffBooking(id: number): Promise<StaffBookingDetail> {
  const res = await apiClient.get<ApiResponse<StaffBookingDetail>>(`/staff/bookings/${id}`)
  return unwrap(res.data)
}

export async function declineBooking(id: number, reason: string): Promise<void> {
  await apiClient.patch(`/staff/bookings/${id}/decline`, { reason })
}

async function act(id: number, action: string, body?: object): Promise<StaffBookingDetail> {
  const res = await apiClient.patch<ApiResponse<StaffBookingDetail>>(
    `/staff/bookings/${id}/${action}`,
    body,
  )
  return unwrap(res.data)
}

export const checkIn = (id: number) => act(id, 'check-in')
export const complete = (id: number) => act(id, 'complete')
export const reportNoShow = (id: number) => act(id, 'no-show')
export const confirmPayment = (id: number, method: PaymentMethod) =>
  act(id, 'confirm-payment', { method })

export async function proposeAdjustment(
  id: number,
  items: ProposedItemInput[],
): Promise<StaffBookingDetail> {
  const res = await apiClient.post<ApiResponse<StaffBookingDetail>>(
    `/staff/bookings/${id}/adjustment`,
    { items },
  )
  return unwrap(res.data)
}
