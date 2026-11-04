import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchService, fetchServiceAreas, fetchServiceReviews, fetchServices } from './api'

export const catalogKeys = {
  services: ['services'] as const,
  service: (slug: string) => ['services', slug] as const,
  serviceAreas: ['service-areas'] as const,
}

export function useServices() {
  return useQuery({ queryKey: catalogKeys.services, queryFn: fetchServices })
}

export function useService(slug: string) {
  return useQuery({
    queryKey: catalogKeys.service(slug),
    queryFn: () => fetchService(slug),
  })
}

export function useServiceAreas() {
  return useQuery({ queryKey: catalogKeys.serviceAreas, queryFn: fetchServiceAreas })
}

export function useServiceReviews(serviceId: number, page: number) {
  return useQuery({
    queryKey: ['services', serviceId, 'reviews', page] as const,
    queryFn: () => fetchServiceReviews(serviceId, page),
    placeholderData: keepPreviousData,
  })
}
