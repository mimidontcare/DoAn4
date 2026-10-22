import { z } from 'zod'

// Khớp CreateAddressDto ở backend; backend vẫn kiểm tra phường có trong vùng phục vụ (Z01).
export const addressSchema = z.object({
  wardId: z.number({ error: 'Chọn phường/xã' }).int().min(1, 'Chọn phường/xã'),
  detail: z
    .string()
    .trim()
    .min(5, 'Địa chỉ chi tiết tối thiểu 5 ký tự')
    .max(255, 'Địa chỉ chi tiết tối đa 255 ký tự'),
  label: z.string().trim().max(50, 'Tên gợi nhớ tối đa 50 ký tự'),
  contactName: z
    .string()
    .trim()
    .min(2, 'Tên người liên hệ tối thiểu 2 ký tự')
    .max(100, 'Tên người liên hệ tối đa 100 ký tự'),
  contactPhone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, 'Số điện thoại gồm 10 số, bắt đầu bằng 0'),
  isDefault: z.boolean(),
})
export type AddressValues = z.infer<typeof addressSchema>
