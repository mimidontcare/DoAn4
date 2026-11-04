import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarOff, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { dateInZone, formatDay } from '@/lib/time'
import { useBlockedDates, useCreateBlockedDate, useDeleteBlockedDate } from '../hooks'
import { blockedDateSchema, type BlockedDateValues } from '../schema'

/** T08: ngày không phục vụ; khách không đặt hoặc đổi lịch vào các ngày này. */
export function AdminBlockedDatesPage() {
  const { data, isPending, isError, error, refetch } = useBlockedDates()
  const create = useCreateBlockedDate()
  const remove = useDeleteBlockedDate()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<BlockedDateValues>({
    resolver: zodResolver(blockedDateSchema),
    mode: 'onTouched',
    defaultValues: { date: '', reason: '' },
  })

  function onSubmit({ date, reason }: BlockedDateValues) {
    create.mutate(
      { date, reason: reason || undefined },
      {
        onSuccess: (created) => {
          reset({ date: '', reason: '' })
          if (created.affectedBookings > 0) {
            toast.warning(
              `Đã chặn ${formatDay(created.date)}. Có ${created.affectedBookings} đơn trong ngày này cần xử lý (đổi lịch hoặc hủy).`,
            )
          } else {
            toast.success(`Đã chặn ${formatDay(created.date)}`)
          }
        },
        onError: (e) => showServerError(e, setError, { Ngày: 'date', ngày: 'date' }),
      },
    )
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Ngày không phục vụ</h1>
        <p className="text-muted-foreground">
          Khách không đặt hoặc đổi lịch được vào các ngày này. Đơn đã có không tự hủy.
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start"
      >
        <FormField id="blocked-date" label="Ngày" error={errors.date?.message}>
          <Input
            id="blocked-date"
            type="date"
            className="h-11"
            min={dateInZone()}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={fieldDescribedBy('blocked-date', errors.date?.message)}
            {...register('date')}
          />
        </FormField>
        <FormField id="blocked-reason" label="Lý do" error={errors.reason?.message}>
          <Input
            id="blocked-reason"
            className="h-11"
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={fieldDescribedBy('blocked-reason', errors.reason?.message)}
            {...register('reason')}
          />
        </FormField>
        <Button type="submit" className="h-11 cursor-pointer sm:mt-7" disabled={create.isPending}>
          {create.isPending ? 'Đang lưu...' : 'Thêm ngày'}
        </Button>
      </form>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-10 text-center">
          <CalendarOff aria-hidden="true" className="size-8 text-primary" />
          <p className="text-muted-foreground">Chưa có ngày nào sắp tới bị chặn.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-2">
          {data.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
            >
              <span>
                <span className="font-semibold">{formatDay(item.date)}</span>
                {item.reason && <span className="text-muted-foreground"> · {item.reason}</span>}
              </span>
              <Button
                variant="ghost"
                className="size-11 cursor-pointer text-destructive hover:text-destructive"
                aria-label={`Bỏ chặn ngày ${formatDay(item.date)}`}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(item.id, {
                    onSuccess: () => toast.success('Đã bỏ chặn'),
                    onError: (e) => toast.error(getApiErrorMessage(e)),
                  })
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
