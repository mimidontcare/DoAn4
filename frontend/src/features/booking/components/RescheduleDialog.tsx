import { AxiosError } from 'axios'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
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
import { FormField } from '@/features/auth/components/FormField'
import { formatVnd } from '@/lib/format'
import { dateInZone, formatDateTime, formatTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useReschedule, useRescheduleOptions } from '../hooks'
import type { BookingDetail } from '../types'

interface RescheduleDialogProps {
  booking: BookingDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** R01: chỉ đổi thời gian; nhóm cũ còn rảnh thì giữ, không thì đơn chờ phân công lại. */
export function RescheduleDialog({ booking, open, onOpenChange }: RescheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Radix gỡ nội dung khi đóng: mỗi lần mở bắt đầu lại từ ngày mai. */}
        <RescheduleForm booking={booking} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RescheduleForm({ booking, onDone }: { booking: BookingDetail; onDone: () => void }) {
  const [date, setDate] = useState(() => dateInZone(1))
  const [picked, setPicked] = useState<string | null>(null)
  const options = useRescheduleOptions(booking.id, date)
  const reschedule = useReschedule(booking.id)

  const slots = options.data?.availableStartTimes ?? []
  const startAt = picked && slots.includes(picked) ? picked : null

  function confirm() {
    if (!startAt || !options.data) return
    reschedule.mutate(
      { startAt, expectedTotal: options.data.total },
      {
        onSuccess: (updated) => {
          toast.success(
            updated.status === 'PENDING' && booking.status === 'CONFIRMED'
              ? 'Đã đổi lịch; nhóm cũ không rảnh nên đơn chờ phân công lại'
              : 'Đã đổi lịch',
          )
          onDone()
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error))
          if (error instanceof AxiosError && error.response?.status === 409) {
            void options.refetch()
          }
        },
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Đổi lịch đơn {booking.code}</DialogTitle>
        <DialogDescription>
          Giờ hiện tại: {formatDateTime(booking.startAt)}. Chỉ đổi thời gian, khối lượng giữ nguyên.
          {options.data && ` Còn ${options.data.remainingReschedules} lần đổi.`}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <FormField id="reschedule-date" label="Ngày mới">
          <Input
            id="reschedule-date"
            type="date"
            className="h-11 sm:w-56"
            min={dateInZone()}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </FormField>
        {options.isPending && <LoadingState />}
        {options.isError && (
          <ErrorState error={options.error} onRetry={() => void options.refetch()} />
        )}
        {options.data && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Giờ bắt đầu mới</legend>
            {options.data.blockedDate ? (
              <p className="text-muted-foreground">
                Ngày này không phục vụ
                {options.data.blockedDate.reason && `: ${options.data.blockedDate.reason}`}.
              </p>
            ) : slots.length === 0 ? (
              <p className="text-muted-foreground">Ngày này không còn giờ trống.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slots.map((slot) => (
                  <label
                    key={slot}
                    className={cn(
                      'flex h-11 cursor-pointer items-center justify-center rounded-md border font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                      slot === startAt
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="reschedule-start"
                      className="sr-only"
                      checked={slot === startAt}
                      onChange={() => setPicked(slot)}
                    />
                    {formatTime(slot)}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
        {options.data && options.data.total !== booking.totalPrice && (
          <p role="status" className="text-sm font-medium text-primary">
            Tổng tiền theo ngày mới: {formatVnd(options.data.total)}
            {options.data.surchargePercent > 0 &&
              ` (gồm phụ phí cuối tuần ${options.data.surchargePercent}%)`}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" className="h-11 cursor-pointer" onClick={onDone}>
          Đóng
        </Button>
        <Button
          className="h-11 cursor-pointer"
          disabled={!startAt || reschedule.isPending}
          onClick={confirm}
        >
          {reschedule.isPending ? 'Đang đổi...' : 'Xác nhận đổi lịch'}
        </Button>
      </DialogFooter>
    </>
  )
}
