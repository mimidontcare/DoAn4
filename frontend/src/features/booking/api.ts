import { apiClient, unwrap, type ApiResponse } from '@/api/client'
import type {
  BookingDetail,
  BookingListQuery,
  BookingPage,
  CreateBookingInput,
  Quote,
  QuoteInput,
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
