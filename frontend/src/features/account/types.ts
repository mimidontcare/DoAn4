import type { WardType } from '@/features/catalog/types'

export interface Address {
  id: number
  detail: string
  label: string | null
  contactName: string
  contactPhone: string
  isDefault: boolean
  createdAt: string
  ward: {
    id: number
    name: string
    type: WardType
    zoneName: string | null
    provinceName: string
  }
  /** false: phường đã ngừng phục vụ, không dùng để đặt lịch được. */
  isServiceable: boolean
}

export interface AddressInput {
  wardId: number
  detail: string
  label?: string
  contactName: string
  contactPhone: string
  isDefault?: boolean
}
