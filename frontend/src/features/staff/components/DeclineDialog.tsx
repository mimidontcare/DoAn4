import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
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
import { useDeclineBooking } from '../hooks'
import { declineSchema, type DeclineValues } from '../schema'

interface DeclineDialogProps {
  bookingId: number
  code: string
  isLeader: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** S02: từ chối việc, bắt buộc lý do; người từ chối rời khỏi đơn. */
export function DeclineDialog({
  bookingId,
  code,
  isLeader,
  open,
  onOpenChange,
}: DeclineDialogProps) {
  const navigate = useNavigate()
  const decline = useDeclineBooking(bookingId)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeclineValues>({
    resolver: zodResolver(declineSchema),
    mode: 'onTouched',
    defaultValues: { reason: '' },
  })
  const error = errors.reason?.message

  function onSubmit({ reason }: DeclineValues) {
    decline.mutate(reason, {
      onSuccess: () => {
        toast.success(`Đã từ chối đơn ${code}`)
        void navigate('/staff', { replace: true })
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Từ chối đơn {code}?</DialogTitle>
          <DialogDescription>
            Bạn sẽ được gỡ khỏi đơn và quản trị sẽ bổ sung người khác.
            {isLeader && ' Bạn đang là trưởng nhóm, quản trị sẽ chọn trưởng nhóm mới.'}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4">
          <FormField id="decline-reason" label="Lý do" error={error}>
            <Textarea
              id="decline-reason"
              rows={3}
              aria-invalid={Boolean(error)}
              aria-describedby={fieldDescribedBy('decline-reason', error)}
              {...register('reason')}
            />
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
            <Button
              type="submit"
              variant="destructive"
              className="h-11 cursor-pointer"
              disabled={decline.isPending}
            >
              {decline.isPending ? 'Đang gửi...' : 'Từ chối việc'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
