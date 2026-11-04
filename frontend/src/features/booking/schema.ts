import { z } from 'zod'
import type { ServiceItem } from '@/features/catalog/types'

export const quantityField = (itemId: number) => `item_${itemId}`

export type QuantityValues = Record<string, string>

/** Bỏ trống hoặc 0 nghĩa là không chọn hạng mục; backend vẫn kiểm tra lại (Q01). */
function isValidQuantity(item: ServiceItem, value: string) {
  if (value === '' || value === '0') return !item.isRequired
  const quantity = Number(value)
  return (
    Number.isInteger(quantity) && quantity >= Math.max(item.minQty, 1) && quantity <= item.maxQty
  )
}

export function buildQuantitySchema(items: ServiceItem[]) {
  const shape = Object.fromEntries(
    items.map((item) => [
      quantityField(item.id),
      z
        .string()
        .trim()
        .refine((value) => isValidQuantity(item, value), {
          message: `Nhập số nguyên từ ${Math.max(item.minQty, 1)} đến ${item.maxQty}`,
        }),
    ]),
  )
  return z.object(shape)
}

const note = z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự')

export const noteSchema = z.object({ note })
export type NoteValues = z.infer<typeof noteSchema>

export const paymentSchema = z.object({ method: z.enum(['CASH', 'BANK_TRANSFER']) })
export type PaymentValues = z.infer<typeof paymentSchema>

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Chọn số sao').max(5),
  comment: z.string().trim().max(1000, 'Nhận xét tối đa 1000 ký tự'),
})
export type ReviewValues = z.infer<typeof reviewSchema>
