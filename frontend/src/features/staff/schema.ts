import { z } from 'zod'
import type { AdjustableItem } from './types'

export const declineSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do tối thiểu 3 ký tự').max(255, 'Lý do tối đa 255 ký tự'),
})
export type DeclineValues = z.infer<typeof declineSchema>

export const proposalField = (itemId: number) => `item_${itemId}`
export type ProposalValues = Record<string, string>

/** A02, Q01: khối lượng đề xuất; backend kiểm tra lại cả mức tăng 30% (A04). */
export function buildProposalSchema(items: AdjustableItem[]) {
  return z.object(
    Object.fromEntries(
      items.map((item) => {
        const min = item.isRequired ? Math.max(item.minQty, 1) : 0
        return [
          proposalField(item.id),
          z
            .string()
            .trim()
            .refine(
              (value) => {
                const quantity = Number(value || 0)
                return (
                  Number.isInteger(quantity) &&
                  (quantity === 0 ? min === 0 : quantity >= Math.max(item.minQty, 1)) &&
                  quantity <= item.maxQty
                )
              },
              { message: `Nhập số nguyên từ ${min} đến ${item.maxQty}` },
            ),
        ]
      }),
    ),
  )
}
