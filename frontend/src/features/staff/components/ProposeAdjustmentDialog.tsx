import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import * as api from '../api'
import { useStaffAction } from '../hooks'
import { buildProposalSchema, proposalField, type ProposalValues } from '../schema'
import type { ProposedItemInput, StaffBookingDetail } from '../types'

interface ProposeAdjustmentDialogProps {
  booking: StaffBookingDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** S04: trưởng nhóm nhập khối lượng thực tế; không nhập giá (A02). */
export function ProposeAdjustmentDialog({
  booking,
  open,
  onOpenChange,
}: ProposeAdjustmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Radix gỡ nội dung khi đóng: form khởi tạo lại từ khối lượng hiện tại mỗi lần mở. */}
        <ProposalForm booking={booking} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ProposalForm({ booking, onDone }: { booking: StaffBookingDetail; onDone: () => void }) {
  const propose = useStaffAction(booking.id, (items: ProposedItemInput[]) =>
    api.proposeAdjustment(booking.id, items),
  )
  const items = booking.adjustableItems
  const currentOf = (itemId: number) =>
    booking.items.find((i) => i.serviceItemId === itemId)?.quantity ?? 0
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProposalValues>({
    resolver: zodResolver(buildProposalSchema(items)),
    mode: 'onTouched',
    defaultValues: Object.fromEntries(
      items.map((item) => [proposalField(item.id), String(currentOf(item.id))]),
    ),
  })
  const values = useWatch({ control })

  // Ước tính phút công để báo sớm vượt 30% (A04); backend vẫn kiểm tra lại.
  const manMinutes = items.reduce(
    (sum, item) => sum + Number(values[proposalField(item.id)] || 0) * item.minutesPerUnit,
    0,
  )
  const overLimit = manMinutes > booking.maxAdjustedManMinutes

  function onSubmit(form: ProposalValues) {
    const changed = items
      .map((item) => ({
        serviceItemId: item.id,
        proposedQuantity: Number(form[proposalField(item.id)] || 0),
      }))
      .filter((item) => item.proposedQuantity !== currentOf(item.serviceItemId))
    if (changed.length === 0) {
      toast.error('Khối lượng đề xuất không thay đổi')
      return
    }
    propose.mutate(changed, {
      onSuccess: () => {
        toast.success('Đã gửi đề xuất, chờ khách xác nhận')
        onDone()
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Đề xuất điều chỉnh khối lượng</DialogTitle>
        <DialogDescription>
          Nhập khối lượng thực tế. Tổng phút công tối đa {booking.maxAdjustedManMinutes} phút; vượt
          mức thì chỉ làm khối lượng đã đặt, phần còn lại khách đặt đơn mới.
        </DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4">
        {items.map((item) => {
          const id = proposalField(item.id)
          const error = errors[id]?.message
          const hint = `Đã đặt ${currentOf(item.id)} · ${formatVnd(item.unitPrice)}/${UNIT_LABEL[item.unit]}`
          return (
            <FormField
              key={item.id}
              id={id}
              label={`${item.name} (${UNIT_LABEL[item.unit]})${item.isRequired ? ' *' : ''}`}
              error={error}
              hint={hint}
            >
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                className="h-11"
                aria-invalid={Boolean(error)}
                aria-describedby={fieldDescribedBy(id, error, hint)}
                {...register(id)}
              />
            </FormField>
          )
        })}
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          Phút công ước tính: {manMinutes}/{booking.maxAdjustedManMinutes}
          {overLimit && ' — vượt mức cho phép'}
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" className="h-11 cursor-pointer" onClick={onDone}>
            Đóng
          </Button>
          <Button
            type="submit"
            className="h-11 cursor-pointer"
            disabled={propose.isPending || overLimit}
          >
            {propose.isPending ? 'Đang gửi...' : 'Gửi đề xuất'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
