import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import { dateInZone, formatTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useCreateBooking, useQuote } from '../hooks'
import { noteSchema, type NoteValues } from '../schema'
import type { BookingItemInput } from '../types'

interface ScheduleStepProps {
  serviceId: number
  addressId: number
  items: BookingItemInput[]
  onBack: () => void
}

export function ScheduleStep({ serviceId, addressId, items, onBack }: ScheduleStepProps) {
  const navigate = useNavigate()
  const [date, setDate] = useState(() => dateInZone(1))
  const [picked, setPicked] = useState<string | null>(null)
  const quote = useQuote({ serviceId, addressId, items, date })
  const create = useCreateBooking()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    mode: 'onTouched',
    defaultValues: { note: '' },
  })

  const slots = quote.data?.availableStartTimes ?? []
  // Đổi ngày hoặc báo giá lại có thể làm giờ đã chọn không còn.
  const startAt = picked && slots.includes(picked) ? picked : null
  const noteError = errors.note?.message

  function onSubmit({ note }: NoteValues) {
    if (!startAt || !quote.data) return
    create.mutate(
      {
        serviceId,
        addressId,
        items,
        startAt,
        expectedTotal: quote.data.total,
        note: note || undefined,
      },
      {
        onSuccess: (booking) => {
          toast.success(`Đã đặt lịch, mã đơn ${booking.code}`)
          void navigate(`/account/bookings/${booking.id}`, { replace: true })
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error))
          // 409: giá đổi hoặc giờ vừa hết chỗ, lấy lại báo giá để khách chọn lại.
          if (error instanceof AxiosError && error.response?.status === 409) {
            void quote.refetch()
          }
        },
      },
    )
  }

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-5">
      <div className="grid gap-4 rounded-xl border bg-card p-4">
        <FormField id="booking-date" label="Ngày làm việc">
          <Input
            id="booking-date"
            type="date"
            className="h-11 sm:w-56"
            min={dateInZone()}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </FormField>

        {quote.isPending && <LoadingState text="Đang tính giá..." />}
        {quote.isError && <ErrorState error={quote.error} onRetry={() => void quote.refetch()} />}
        {quote.data && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Giờ bắt đầu</legend>
            {quote.data.blockedDate ? (
              <p className="text-muted-foreground">
                Ngày này không phục vụ
                {quote.data.blockedDate.reason && `: ${quote.data.blockedDate.reason}`}, vui lòng
                chọn ngày khác.
              </p>
            ) : slots.length === 0 ? (
              <p className="text-muted-foreground">
                Ngày này không còn giờ trống, vui lòng chọn ngày khác.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {slots.map((slot) => (
                  <label
                    key={slot}
                    className={cn(
                      'flex h-11 cursor-pointer items-center justify-center rounded-md border font-medium transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                      slot === startAt ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="startAt"
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
      </div>

      {quote.data && (
        <section aria-labelledby="quote-heading" className="grid gap-3 rounded-xl border bg-card p-4">
          <h2 id="quote-heading" className="text-lg font-semibold">
            Giá tạm tính
          </h2>
          <ul className="grid gap-1">
            {quote.data.lines.map((line) => (
              <li key={line.serviceItemId} className="flex justify-between gap-4">
                <span>
                  {line.name} × {line.quantity} {UNIT_LABEL[line.unit]}
                </span>
                <span className="whitespace-nowrap">{formatVnd(line.amount)}</span>
              </li>
            ))}
          </ul>
          {quote.data.subtotal > quote.data.itemsTotal && (
            <p className="text-sm text-muted-foreground">
              Áp dụng mức tối thiểu của dịch vụ: {formatVnd(quote.data.subtotal)}
            </p>
          )}
          {quote.data.surcharge > 0 && (
            <p className="flex justify-between gap-4">
              <span>Phụ phí cuối tuần ({quote.data.surchargePercent}%)</span>
              <span className="whitespace-nowrap">{formatVnd(quote.data.surcharge)}</span>
            </p>
          )}
          <p className="flex justify-between border-t pt-2 text-lg font-semibold">
            <span>Tổng cộng</span>
            <span className="text-primary">{formatVnd(quote.data.total)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {quote.data.staffCount} nhân viên · khoảng {quote.data.durationMinutes} phút. Khối lượng
            thực tế được kiểm tra khi nhân viên đến. Thanh toán sau khi hoàn thành.
          </p>
        </section>
      )}

      <FormField id="booking-note" label="Ghi chú" error={noteError}>
        <Textarea
          id="booking-note"
          rows={3}
          className="bg-card"
          aria-invalid={Boolean(noteError)}
          aria-describedby={fieldDescribedBy('booking-note', noteError)}
          {...register('note')}
        />
      </FormField>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" className="h-11 cursor-pointer" onClick={onBack}>
          Quay lại
        </Button>
        <Button
          type="submit"
          variant="cta"
          className="h-11 cursor-pointer px-6"
          disabled={!startAt || create.isPending}
        >
          {create.isPending ? 'Đang đặt lịch...' : 'Xác nhận đặt lịch'}
        </Button>
      </div>
    </form>
  )
}
