import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { BookingListQuery, QuoteInput } from './types'

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (query: BookingListQuery) => ['bookings', 'list', query] as const,
  detail: (id: number) => ['bookings', 'detail', id] as const,
  quote: (input: QuoteInput) => ['quote', input] as const,
}

/** Luôn lấy mới: giá và giờ trống có thể đổi bất cứ lúc nào. */
export function useQuote(input: QuoteInput) {
  return useQuery({
    queryKey: bookingKeys.quote(input),
    queryFn: () => api.fetchQuote(input),
    retry: false,
    gcTime: 0,
  })
}

export function useCreateBooking() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  })
}

export function useMyBookings(query: BookingListQuery) {
  return useQuery({
    queryKey: bookingKeys.list(query),
    queryFn: () => api.fetchMyBookings(query),
    placeholderData: keepPreviousData,
  })
}

export function useBooking(id: number) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => api.fetchBooking(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

export function useCancelBooking(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (note?: string) => api.cancelBooking(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  })
}

export function useRespondAdjustment(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accept: boolean) => api.respondAdjustment(id, accept),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
  })
}
