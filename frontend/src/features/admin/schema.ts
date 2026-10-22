import { z } from 'zod'

// Khớp DTO của backend (CreateServiceDto, CreateServiceItemDto); backend vẫn quyết định cuối cùng.
const MAX_MONEY = 1_000_000_000
const MAX_QTY = 100_000
const MAX_MINUTES = 24 * 60
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Ô số nhập bằng register(..., { valueAsNumber: true }): ô trống cho ra NaN. */
const int = (min: number, max: number) =>
  z
    .number({ error: 'Vui lòng nhập số' })
    .int('Phải là số nguyên')
    .min(min, `Tối thiểu ${min}`)
    .max(max, `Tối đa ${max.toLocaleString('vi-VN')}`)

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(150, 'Tên tối đa 150 ký tự'),
  slug: z
    .string()
    .trim()
    .max(160, 'Slug tối đa 160 ký tự')
    .refine((v) => v === '' || SLUG.test(v), {
      message: 'Chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
    }),
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự'),
  imageUrl: z.string().max(500),
  minCharge: int(0, MAX_MONEY),
  sortOrder: int(0, 9999),
})
export type ServiceValues = z.infer<typeof serviceSchema>

export const serviceItemSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(150, 'Tên tối đa 150 ký tự'),
    unit: z.enum(['UNIT', 'M2']),
    unitPrice: int(0, MAX_MONEY),
    minutesPerUnit: int(0, MAX_MINUTES),
    minQty: int(0, MAX_QTY),
    maxQty: int(1, MAX_QTY),
    isRequired: z.boolean(),
    sortOrder: int(0, 9999),
  })
  .refine((v) => v.minQty <= v.maxQty, {
    path: ['maxQty'],
    message: 'Số lượng tối đa phải ≥ số lượng tối thiểu',
  })
  .refine((v) => !v.isRequired || v.minQty >= 1, {
    path: ['minQty'],
    message: 'Hạng mục bắt buộc cần số lượng tối thiểu từ 1',
  })
export type ServiceItemValues = z.infer<typeof serviceItemSchema>

export const zoneSchema = z.object({
  name: z.string().trim().min(2, 'Tên tối thiểu 2 ký tự').max(100, 'Tên tối đa 100 ký tự'),
})
export type ZoneValues = z.infer<typeof zoneSchema>
