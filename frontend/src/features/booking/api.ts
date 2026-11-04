import { apiClient, unwrap, type ApiResponse } from '@/api/client'
import type {
  BookingDetail,
  BookingListQuery,
  BookingPage,
  CreateBookingInput,
  Quote,
  QuoteInput,
  RescheduleInput,
  RescheduleOptions,
  ReviewInput,
} from './types'

export async function fetchQuote(input: QuoteInput): Promise<Quote> {
  const res = await apiClient.post<ApiResponse<Quote>>('/bookings/quote', input)
  return unwrap(res.data)
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDetail> {
  const res = await apiClient.post<ApiResponse<BookingDetail>>('/bookings', input)
  return unwrap(res.data)
}

export async function fetchMyBookings(params: BookingListQuery): Promise<BookingPage> {
  const res = await apiClient.get<ApiResponse<BookingPage>>('/me/bookings', { params })
  return unwrap(res.data)
}

export async function fetchBooking(id: number): Promise<BookingDetail> {
  const res = await apiClient.get<ApiResponse<BookingDetail>>(`/bookings/${id}`)
  return unwrap(res.data)
}

export async function cancelBooking(id: number, note?: string): Promise<BookingDetail> {
  const res = await apiClient.patch<ApiResponse<BookingDetail>>(`/bookings/${id}/cancel`, {
    note,
  })
  return unwrap(res.data)
}

export async function respondAdjustment(id: number, accept: boolean): Promise<BookingDetail> {
  const res = await apiClient.patch<ApiResponse<BookingDetail>>(`/bookings/${id}/adjustment`, {
    accept,
  })
  return unwrap(res.data)
}

export async function createReview(id: number, input: ReviewInput): Promise<void> {
  await apiClient.post(`/bookings/${id}/review`, input)
}

export async function fetchRescheduleOptions(id: number, date: string): Promise<RescheduleOptions> {
  const res = await apiClient.get<ApiResponse<RescheduleOptions>>(
    `/bookings/${id}/reschedule-options`,
    { params: { date } },
  )
  return unwrap(res.data)
}

export async function rescheduleBooking(id: number, input: RescheduleInput): Promise<BookingDetail> {
  const res = await apiClient.patch<ApiResponse<BookingDetail>>(`/bookings/${id}/reschedule`, input)
  return unwrap(res.data)
}
