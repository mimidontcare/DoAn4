import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { catalogKeys } from '@/features/catalog/hooks'
import type { PaymentMethod } from '@/features/booking/types'
import * as api from './api'
import type {
  AdminReviewFilters,
  AdminBookingFilters,
  AdminCancelInput,
  AssignTeamInput,
  ServiceInput,
  ServiceItemInput,
  StaffFilters,
  WardFilters,
} from './types'

export const adminKeys = {
  services: ['admin', 'services'] as const,
  service: (id: number) => ['admin', 'services', id] as const,
  provinces: ['admin', 'provinces'] as const,
  zones: (provinceId: number) => ['admin', 'zones', provinceId] as const,
  wardsRoot: ['admin', 'wards'] as const,
  wards: (filters: WardFilters) => ['admin', 'wards', filters] as const,
  bookingsRoot: ['admin', 'bookings'] as const,
  bookings: (filters: AdminBookingFilters) => ['admin', 'bookings', 'list', filters] as const,
  booking: (id: number) => ['admin', 'bookings', 'detail', id] as const,
  availableStaff: (id: number) => ['admin', 'bookings', 'available-staff', id] as const,
}

export function useAdminBookings(filters: AdminBookingFilters) {
  return useQuery({
    queryKey: adminKeys.bookings(filters),
    queryFn: () => api.fetchAdminBookings(filters),
    placeholderData: keepPreviousData,
  })
}

export function useAdminBooking(id: number) {
  return useQuery({
    queryKey: adminKeys.booking(id),
    queryFn: () => api.fetchAdminBooking(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

/** Lấy mới mỗi lần mở dialog: danh sách người rảnh đổi theo các phân công khác. */
export function useAvailableStaff(id: number, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.availableStaff(id),
    queryFn: () => api.fetchAvailableStaff(id),
    enabled,
    gcTime: 0,
  })
}

function useInvalidateBookings() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.bookingsRoot })
}

export function useAssignTeam(id: number) {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: (input: AssignTeamInput) => api.assignTeam(id, input),
    // Lỗi 409 cũng làm mới: version và danh sách người rảnh đã đổi.
    onSettled: invalidate,
  })
}

export function useCancelAdminBooking(id: number) {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: (input: AdminCancelInput) => api.cancelAdminBooking(id, input),
    onSettled: invalidate,
  })
}

export function useRespondAdminAdjustment(id: number) {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: (accept: boolean) => api.respondAdminAdjustment(id, accept),
    onSettled: invalidate,
  })
}

export function useConfirmAdminPayment(id: number) {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: (method: PaymentMethod) => api.confirmAdminPayment(id, method),
    onSettled: invalidate,
  })
}

/** Mọi thay đổi catalog làm mới cả dữ liệu admin lẫn trang công khai. */
function useInvalidateCatalog() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.services }),
      queryClient.invalidateQueries({ queryKey: catalogKeys.services }),
    ])
}

function useInvalidateAreas() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.provinces }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'zones'] }),
      queryClient.invalidateQueries({ queryKey: adminKeys.wardsRoot }),
      queryClient.invalidateQueries({ queryKey: catalogKeys.serviceAreas }),
    ])
}

const toastError = (error: unknown) => toast.error(getApiErrorMessage(error))

// ---------- Dịch vụ ----------

export function useAdminServices() {
  return useQuery({ queryKey: adminKeys.services, queryFn: api.fetchAdminServices })
}

export function useAdminService(id: number) {
  return useQuery({
    queryKey: adminKeys.service(id),
    queryFn: () => api.fetchAdminService(id),
  })
}

export function useCreateService() {
  const invalidate = useInvalidateCatalog()
  return useMutation({ mutationFn: api.createService, onSuccess: invalidate })
}

export function useUpdateService(id: number) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (input: Partial<ServiceInput>) => api.updateService(id, input),
    onSuccess: invalidate,
  })
}

export function useSetServiceActive() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.setServiceActive(id, isActive),
    onSuccess: invalidate,
    onError: toastError,
  })
}

export function useSaveServiceItem(serviceId: number) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId?: number; input: ServiceItemInput }) =>
      itemId
        ? api.updateServiceItem(serviceId, itemId, input)
        : api.createServiceItem(serviceId, input),
    onSuccess: invalidate,
  })
}

export function useSetServiceItemActive(serviceId: number) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ itemId, isActive }: { itemId: number; isActive: boolean }) =>
      api.setServiceItemActive(serviceId, itemId, isActive),
    onSuccess: invalidate,
    onError: toastError,
  })
}

export function useUploadImage() {
  return useMutation({ mutationFn: api.uploadImage })
}

// ---------- Vùng phục vụ ----------

export function useProvinces() {
  return useQuery({ queryKey: adminKeys.provinces, queryFn: api.fetchProvinces })
}

export function useActivateProvince() {
  const invalidate = useInvalidateAreas()
  return useMutation({
    mutationFn: api.activateProvince,
    onSuccess: invalidate,
    onError: toastError,
  })
}

export function useZones(provinceId: number | undefined) {
  return useQuery({
    queryKey: adminKeys.zones(provinceId ?? 0),
    queryFn: () => api.fetchZones(provinceId!),
    enabled: provinceId !== undefined,
  })
}

export function useSaveZone() {
  const invalidate = useInvalidateAreas()
  return useMutation({
    mutationFn: (
      input: { id: number; name?: string; isActive?: boolean } | { provinceId: number; name: string },
    ) =>
      'id' in input
        ? api.updateZone(input.id, { name: input.name, isActive: input.isActive })
        : api.createZone(input),
    onSuccess: invalidate,
  })
}

export function useWards(filters: WardFilters | undefined) {
  return useQuery({
    queryKey: filters ? adminKeys.wards(filters) : adminKeys.wardsRoot,
    queryFn: () => api.fetchWards(filters!),
    enabled: filters !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useUpdateWard() {
  const invalidate = useInvalidateAreas()
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: number
      zoneId?: number | null
      isActive?: boolean
    }) => api.updateWard(id, input),
    onSuccess: invalidate,
    onError: toastError,
  })
}

// ---------- Nhân viên ----------

export const staffKeys = {
  root: ['admin', 'staff'] as const,
  list: (filters: StaffFilters) => ['admin', 'staff', 'list', filters] as const,
  detail: (id: number) => ['admin', 'staff', id] as const,
  unavailabilities: (id: number) => ['admin', 'staff', id, 'unavailabilities'] as const,
}

/** Khu vực của mọi tỉnh, dùng khi gán khu vực cho nhân viên. */
export function useAllZones() {
  return useQuery({ queryKey: ['admin', 'zones', 'all'], queryFn: () => api.fetchZones() })
}

export function useStaffList(filters: StaffFilters) {
  return useQuery({
    queryKey: staffKeys.list(filters),
    queryFn: () => api.fetchStaffList(filters),
    placeholderData: keepPreviousData,
  })
}

export function useStaff(id: number) {
  return useQuery({ queryKey: staffKeys.detail(id), queryFn: () => api.fetchStaff(id) })
}

function useInvalidateStaff() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: staffKeys.root })
}

export function useCreateStaff() {
  const invalidate = useInvalidateStaff()
  return useMutation({ mutationFn: api.createStaff, onSuccess: invalidate })
}

export function useUpdateStaff(id: number) {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: (input: { fullName?: string; phone?: string }) => api.updateStaff(id, input),
    onSuccess: invalidate,
  })
}

export function useSetStaffZones(id: number) {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: (zoneIds: number[]) => api.setStaffZones(id, zoneIds),
    onSuccess: invalidate,
    onError: toastError,
  })
}

export function useSetUserLocked() {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) =>
      api.setUserLocked(id, locked),
    onSuccess: invalidate,
    onError: toastError,
  })
}

export function useUnavailabilities(staffId: number) {
  return useQuery({
    queryKey: staffKeys.unavailabilities(staffId),
    queryFn: () => api.fetchUnavailabilities(staffId),
  })
}

export function useCreateUnavailability(staffId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { startAt: string; endAt: string; reason?: string }) =>
      api.createUnavailability(staffId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: staffKeys.unavailabilities(staffId) }),
  })
}

export function useDeleteUnavailability(staffId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteUnavailability(staffId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: staffKeys.unavailabilities(staffId) }),
    onError: toastError,
  })
}

// ---------- Tổng quan, đánh giá, ngày không phục vụ ----------

export function useDashboard() {
  return useQuery({ queryKey: ['admin', 'dashboard'] as const, queryFn: api.fetchDashboard })
}

export function useAdminReviews(filters: AdminReviewFilters) {
  return useQuery({
    queryKey: ['admin', 'reviews', filters] as const,
    queryFn: () => api.fetchAdminReviews(filters),
    placeholderData: keepPreviousData,
  })
}

export function useSetReviewHidden() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => api.setReviewHidden(id, hidden),
    // Điểm trên dashboard và trang dịch vụ đổi theo.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin'] }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.services }),
      ]),
  })
}

const blockedDatesKey = ['admin', 'blocked-dates'] as const

export function useBlockedDates() {
  return useQuery({ queryKey: blockedDatesKey, queryFn: api.fetchBlockedDates })
}

export function useCreateBlockedDate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createBlockedDate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blockedDatesKey }),
  })
}

export function useDeleteBlockedDate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteBlockedDate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blockedDatesKey }),
  })
}
