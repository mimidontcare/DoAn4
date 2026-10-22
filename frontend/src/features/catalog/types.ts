export type PricingUnit = 'UNIT' | 'M2'

export interface ServiceItem {
  id: number
  name: string
  unit: PricingUnit
  /** VND, số nguyên. */
  unitPrice: number
  minutesPerUnit: number
  minQty: number
  maxQty: number
  isRequired: boolean
  sortOrder: number
}

export interface Service {
  id: number
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  /** Mức tối thiểu (VND). */
  minCharge: number
  sortOrder: number
  items: ServiceItem[]
}

export type WardType = 'PHUONG' | 'XA'

export interface PublicWard {
  id: number
  code: string
  name: string
  type: WardType
  oldNameHint: string | null
}

export interface ServiceAreas {
  province: { id: number; code: string; name: string } | null
  zones: { id: number; name: string; wards: PublicWard[] }[]
}
