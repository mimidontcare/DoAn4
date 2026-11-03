import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/features/auth/components/FormField'
import { NativeSelect } from '@/components/ui/native-select'
import { formatVnd } from '@/lib/format'
import { PAYMENT_METHOD_LABEL } from '../labels'
import { paymentSchema, type PaymentValues } from '../schema'
import type { PaymentMethod } from '../types'

interface ConfirmPaymentDialogProps {
  code: string
  total: number
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (method: PaymentMethod) => void
}

/** B03, S06: xác nhận đã thu tiền, dùng chung cho trưởng nhóm và admin. */
export function ConfirmPaymentDialog({
  code,
  total,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: ConfirmPaymentDialogProps) {
  const { register, handleSubmit } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'CASH' },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xác nhận đã thu tiền đơn {code}</DialogTitle>
          <DialogDescription>Số tiền cần thu: {formatVnd(total)}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => void handleSubmit(({ method }) => onConfirm(method))(e)}
          className="grid gap-4"
        >
          <FormField id="payment-method" label="Hình thức thanh toán">
            <NativeSelect id="payment-method" {...register('method')}>
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABEL[method]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="h-11 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Đóng
            </Button>
            <Button type="submit" className="h-11 cursor-pointer" disabled={pending}>
              {pending ? 'Đang lưu...' : 'Đã thu tiền'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
