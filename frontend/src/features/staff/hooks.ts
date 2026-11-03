import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { StaffBookingDetail } from './types'

export const staffKeys = {
  all: ['staff', 'bookings'] as const,
  schedule: (from: string, to: string) => ['staff', 'bookings', 'schedule', from, to] as const,
  booking: (id: number) => ['staff', 'bookings', 'detail', id] as const,
}

export function useSchedule(from: string, to: string) {
  return useQuery({
    queryKey: staffKeys.schedule(from, to),
    queryFn: () => api.fetchSchedule(from, to),
  })
}

export function useStaffBooking(id: number) {
  return useQuery({
    queryKey: staffKeys.booking(id),
    queryFn: () => api.fetchStaffBooking(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

/** Thao tác trả về chi tiết mới: ghi thẳng vào cache, rồi làm mới lịch. */
export function useStaffAction<T>(id: number, action: (input: T) => Promise<StaffBookingDetail>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSuccess: (detail) => queryClient.setQueryData(staffKeys.booking(id), detail),
    // Lỗi 409 cũng làm mới: đơn vừa đổi ở phía khác.
    onSettled: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  })
}

export function useDeclineBooking(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => api.declineBooking(id, reason),
    onSuccess: () => queryClient.removeQueries({ queryKey: staffKeys.booking(id) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  })
}
