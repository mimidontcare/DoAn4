import { z } from 'zod'

// Khớp rule của backend (C01): backend vẫn là nơi quyết định cuối cùng.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72
const VN_PHONE = /^0\d{9}$/

const email = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .pipe(z.email('Email không hợp lệ'))

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự`)
  .max(PASSWORD_MAX, `Mật khẩu tối đa ${PASSWORD_MAX} ký tự`)

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Họ tên tối thiểu 2 ký tự')
      .max(100, 'Họ tên tối đa 100 ký tự'),
    email,
    phone: z
      .string()
      .trim()
      .regex(VN_PHONE, 'Số điện thoại gồm 10 số, bắt đầu bằng 0'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })
export type RegisterValues = z.infer<typeof registerSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
