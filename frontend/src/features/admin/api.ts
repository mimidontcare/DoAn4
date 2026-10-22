import { apiClient, unwrap, type ApiResponse } from '@/api/client'
import type {
  AdminService,
  AdminServiceItem,
  AdminServiceSummary,
  CreateStaffInput,
  Paginated,
  Province,
  ServiceInput,
  ServiceItemInput,
  Staff,
  StaffFilters,
  Unavailability,
  Ward,
  WardFilters,
  Zone,
} from './types'

// ---------- Dịch vụ, hạng mục ----------

export async function fetchAdminServices(): Promise<AdminServiceSummary[]> {
  const res = await apiClient.get<ApiResponse<AdminServiceSummary[]>>('/admin/services')
  return unwrap(res.data)
}

export async function fetchAdminService(id: number): Promise<AdminService> {
  const res = await apiClient.get<ApiResponse<AdminService>>(`/admin/services/${id}`)
  return unwrap(res.data)
}

export async function createService(input: ServiceInput): Promise<AdminService> {
  const res = await apiClient.post<ApiResponse<AdminService>>('/admin/services', input)
  return unwrap(res.data)
}

export async function updateService(
  id: number,
  input: Partial<ServiceInput>,
): Promise<AdminService> {
  const res = await apiClient.put<ApiResponse<AdminService>>(
    `/admin/services/${id}`,
    input,
  )
  return unwrap(res.data)
}

export async function setServiceActive(
  id: number,
  isActive: boolean,
): Promise<AdminService> {
  const res = await apiClient.patch<ApiResponse<AdminService>>(
    `/admin/services/${id}/status`,
    { isActive },
  )
  return unwrap(res.data)
}

export async function createServiceItem(
  serviceId: number,
  input: ServiceItemInput,
): Promise<AdminServiceItem> {
  const res = await apiClient.post<ApiResponse<AdminServiceItem>>(
    `/admin/services/${serviceId}/items`,
    input,
  )
  return unwrap(res.data)
}

export async function updateServiceItem(
  serviceId: number,
  itemId: number,
  input: Partial<ServiceItemInput>,
): Promise<AdminServiceItem> {
  const res = await apiClient.put<ApiResponse<AdminServiceItem>>(
    `/admin/services/${serviceId}/items/${itemId}`,
    input,
  )
  return unwrap(res.data)
}

export async function setServiceItemActive(
  serviceId: number,
  itemId: number,
  isActive: boolean,
): Promise<AdminServiceItem> {
  const res = await apiClient.patch<ApiResponse<AdminServiceItem>>(
    `/admin/services/${serviceId}/items/${itemId}/status`,
    { isActive },
  )
  return unwrap(res.data)
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<ApiResponse<{ url: string }>>('/admin/uploads', form)
  return unwrap(res.data)
}

// ---------- Vùng phục vụ ----------

export async function fetchProvinces(): Promise<Province[]> {
  const res = await apiClient.get<ApiResponse<Province[]>>('/admin/provinces')
  return unwrap(res.data)
}

export async function activateProvince(id: number): Promise<Province> {
  const res = await apiClient.patch<ApiResponse<Province>>(
    `/admin/provinces/${id}/activate`,
  )
  return unwrap(res.data)
}

/** provinceId bỏ trống: khu vực của mọi tỉnh. */
export async function fetchZones(provinceId?: number): Promise<Zone[]> {
  const res = await apiClient.get<ApiResponse<Zone[]>>('/admin/zones', {
    params: { provinceId },
  })
  return unwrap(res.data)
}

export async function createZone(input: {
  provinceId: number
  name: string
}): Promise<Zone> {
  const res = await apiClient.post<ApiResponse<Zone>>('/admin/zones', input)
  return unwrap(res.data)
}

export async function updateZone(
  id: number,
  input: { name?: string; isActive?: boolean },
): Promise<Zone> {
  const res = await apiClient.put<ApiResponse<Zone>>(`/admin/zones/${id}`, input)
  return unwrap(res.data)
}

export async function fetchWards(filters: WardFilters): Promise<Paginated<Ward>> {
  const res = await apiClient.get<ApiResponse<Paginated<Ward>>>('/admin/wards', {
    params: {
      provinceId: filters.provinceId,
      zoneId: typeof filters.zone === 'number' ? filters.zone : undefined,
      unassigned: filters.zone === 'none' ? true : undefined,
      isActive: filters.isActive,
      q: filters.q || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    },
  })
  return unwrap(res.data)
}

export async function updateWard(
  id: number,
  input: { zoneId?: number | null; isActive?: boolean },
): Promise<Ward> {
  const res = await apiClient.patch<ApiResponse<Ward>>(`/admin/wards/${id}`, input)
  return unwrap(res.data)
}

// ---------- Nhân viên ----------

export async function fetchStaffList(filters: StaffFilters): Promise<Paginated<Staff>> {
  const res = await apiClient.get<ApiResponse<Paginated<Staff>>>('/admin/staff', {
    params: { ...filters, q: filters.q || undefined },
  })
  return unwrap(res.data)
}

export async function fetchStaff(id: number): Promise<Staff> {
  const res = await apiClient.get<ApiResponse<Staff>>(`/admin/staff/${id}`)
  return unwrap(res.data)
}

export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  const res = await apiClient.post<ApiResponse<Staff>>('/admin/staff', input)
  return unwrap(res.data)
}

export async function updateStaff(
  id: number,
  input: { fullName?: string; phone?: string },
): Promise<Staff> {
  const res = await apiClient.put<ApiResponse<Staff>>(`/admin/staff/${id}`, input)
  return unwrap(res.data)
}

export async function setStaffZones(id: number, zoneIds: number[]): Promise<Staff> {
  const res = await apiClient.put<ApiResponse<Staff>>(`/admin/staff/${id}/zones`, {
    zoneIds,
  })
  return unwrap(res.data)
}

/** Khóa/mở khóa dùng chung cho nhân viên và khách. */
export async function setUserLocked(id: number, locked: boolean): Promise<void> {
  await apiClient.patch(`/admin/users/${id}/${locked ? 'lock' : 'unlock'}`)
}

export async function fetchUnavailabilities(staffId: number): Promise<Unavailability[]> {
  const res = await apiClient.get<ApiResponse<Unavailability[]>>(
    `/admin/staff/${staffId}/unavailabilities`,
  )
  return unwrap(res.data)
}

export async function createUnavailability(
  staffId: number,
  input: { startAt: string; endAt: string; reason?: string },
): Promise<Unavailability> {
  const res = await apiClient.post<ApiResponse<Unavailability>>(
    `/admin/staff/${staffId}/unavailabilities`,
    input,
  )
  return unwrap(res.data)
}

export async function deleteUnavailability(staffId: number, id: number): Promise<void> {
  await apiClient.delete(`/admin/staff/${staffId}/unavailabilities/${id}`)
}
