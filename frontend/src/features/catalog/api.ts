import { apiClient, unwrap, type ApiResponse } from '@/api/client'
import type { Service, ServiceAreas } from './types'

export async function fetchServices(): Promise<Service[]> {
  const res = await apiClient.get<ApiResponse<Service[]>>('/services')
  return unwrap(res.data)
}

export async function fetchService(slug: string): Promise<Service> {
  const res = await apiClient.get<ApiResponse<Service>>(
    `/services/${encodeURIComponent(slug)}`,
  )
  return unwrap(res.data)
}

export async function fetchServiceAreas(): Promise<ServiceAreas> {
  const res = await apiClient.get<ApiResponse<ServiceAreas>>('/service-areas')
  return unwrap(res.data)
}
