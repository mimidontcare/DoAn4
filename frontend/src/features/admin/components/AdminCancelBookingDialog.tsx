import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { CANCEL_REASON_LABEL } from '@/features/booking/labels'
import { useCancelAdminBooking } from '../hooks'
import { ADMIN_CANCEL_REASONS, adminCancelSchema, type AdminCancelValues } from '../schema'

interface AdminCancelBookingDialogProps {
  bookingId: number
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminCancelBookingDialog({
  bookingId,
  code,
  open,
  onOpenChange,
}: AdminCancelBookingDialogProps) {
  const cancel = useCancelAdminBooking(bookingId)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminCancelValues>({
    resolver: zodResolver(adminCancelSchema),
    mode: 'onTouched',
    defaultValues: { reason: 'NO_STAFF_AVAILABLE', note: '' },
  })
  const noteError = errors.note?.message

  function onSubmit({ reason, note }: AdminCancelValues) {
    cancel.mutate(
      { reason, note: note || undefined },
      {
        onSuccess: () => {
          toast.success('Đã hủy đơn')
          onOpenChange(false)
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hủy đơn {code}?</DialogTitle>
          <DialogDescription>Đơn đã hủy không khôi phục được.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4">
          <FormField id="admin-cancel-reason" label="Lý do">
            <NativeSelect id="admin-cancel-reason" {...register('reason')}>
              {ADMIN_CANCEL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {CANCEL_REASON_LABEL[reason]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="admin-cancel-note" label="Ghi chú" error={noteError}>
            <Textarea
              id="admin-cancel-note"
              rows={3}
              aria-invalid={Boolean(noteError)}
              aria-describedby={fieldDescribedBy('admin-cancel-note', noteError)}
              {...register('note')}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="h-11 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Giữ đơn
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="h-11 cursor-pointer"
              disabled={cancel.isPending}
            >
              {cancel.isPending ? 'Đang hủy...' : 'Hủy đơn'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
