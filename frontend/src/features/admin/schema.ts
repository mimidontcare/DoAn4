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

const VN_PHONE = /^0\d{9}$/
const fullName = z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự')
const phone = z.string().trim().regex(VN_PHONE, 'Số điện thoại gồm 10 số, bắt đầu bằng 0')

/** U01: mật khẩu tạm, nhân viên bị bắt đổi ở lần đăng nhập đầu. */
export const createStaffSchema = z.object({
  fullName,
  email: z.string().trim().min(1, 'Vui lòng nhập email').pipe(z.email('Email không hợp lệ')),
  phone,
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
})
export type CreateStaffValues = z.infer<typeof createStaffSchema>

export const updateStaffSchema = z.object({ fullName, phone })
export type UpdateStaffValues = z.infer<typeof updateStaffSchema>

/** Giá trị ô datetime-local, hiểu theo múi giờ nghiệp vụ; chuỗi cùng định dạng nên so sánh trực tiếp được. */
export const unavailabilitySchema = z
  .object({
    startAt: z.string().min(1, 'Chọn thời gian bắt đầu'),
    endAt: z.string().min(1, 'Chọn thời gian kết thúc'),
    reason: z.string().trim().max(255, 'Lý do tối đa 255 ký tự'),
  })
  .refine((v) => !v.startAt || !v.endAt || v.endAt > v.startAt, {
    path: ['endAt'],
    message: 'Kết thúc phải sau bắt đầu',
  })
export type UnavailabilityValues = z.infer<typeof unavailabilitySchema>
