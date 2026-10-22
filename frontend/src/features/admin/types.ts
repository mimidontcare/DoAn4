import type { PricingUnit, WardType } from '@/features/catalog/types'

export interface AdminServiceItem {
  id: number
  name: string
  unit: PricingUnit
  unitPrice: number
  minutesPerUnit: number
  minQty: number
  maxQty: number
  isRequired: boolean
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

interface AdminServiceBase {
  id: number
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  minCharge: number
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

export interface AdminServiceSummary extends AdminServiceBase {
  _count: { items: number }
}

export interface AdminService extends AdminServiceBase {
  items: AdminServiceItem[]
}

export interface ServiceInput {
  name: string
  slug?: string
  description?: string
  imageUrl?: string
  minCharge: number
  sortOrder?: number
}

export interface ServiceItemInput {
  name: string
  unit: PricingUnit
  unitPrice: number
  minutesPerUnit: number
  minQty: number
  maxQty: number
  isRequired: boolean
  sortOrder?: number
}

export interface Province {
  id: number
  code: string
  name: string
  isActive: boolean
  _count: { zones: number; wards: number }
}

export interface Zone {
  id: number
  provinceId: number
  name: string
  isActive: boolean
  _count: { wards: number }
}

export interface Ward {
  id: number
  provinceId: number
  code: string
  name: string
  type: WardType
  oldNameHint: string | null
  isActive: boolean
  zone: { id: number; name: string; isActive: boolean } | null
}

export interface WardFilters {
  provinceId: number
  /** number: theo khu vực; 'none': chưa gán; undefined: tất cả. */
  zone?: number | 'none'
  isActive?: boolean
  q?: string
  page: number
  pageSize: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
