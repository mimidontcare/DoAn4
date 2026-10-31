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
import { Textarea } from '@/components/ui/textarea'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { useCancelBooking } from '../hooks'
import { noteSchema, type NoteValues } from '../schema'

interface CancelBookingDialogProps {
  bookingId: number
  code: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CancelBookingDialog({
  bookingId,
  code,
  open,
  onOpenChange,
}: CancelBookingDialogProps) {
  const cancel = useCancelBooking(bookingId)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    mode: 'onTouched',
    defaultValues: { note: '' },
  })
  const noteError = errors.note?.message

  function onSubmit({ note }: NoteValues) {
    cancel.mutate(note || undefined, {
      onSuccess: () => {
        toast.success('Đã hủy đơn')
        onOpenChange(false)
      },
      onError: (error) => toast.error(getApiErrorMessage(error)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hủy đơn {code}?</DialogTitle>
          <DialogDescription>
            Đơn đã hủy không khôi phục được. Hủy sát giờ làm việc có thể bị tính là hủy muộn.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4">
          <FormField id="cancel-note" label="Ghi chú" error={noteError}>
            <Textarea
              id="cancel-note"
              rows={3}
              aria-invalid={Boolean(noteError)}
              aria-describedby={fieldDescribedBy('cancel-note', noteError)}
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
