import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { APP_TIMEZONE, formatDateTime, zonedInputToIso } from '@/lib/time'
import { useCreateUnavailability, useDeleteUnavailability, useUnavailabilities } from '../hooks'
import { unavailabilitySchema, type UnavailabilityValues } from '../schema'

const EMPTY: UnavailabilityValues = { startAt: '', endAt: '', reason: '' }

/** A04: lịch nghỉ do admin nhập. Giờ nhập theo múi giờ nghiệp vụ, gửi lên dạng UTC (T07). */
export function UnavailabilitiesCard({ staffId }: { staffId: number }) {
  const { data, isPending, isError, error, refetch } = useUnavailabilities(staffId)
  const create = useCreateUnavailability(staffId)
  const remove = useDeleteUnavailability(staffId)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UnavailabilityValues>({
    resolver: zodResolver(unavailabilitySchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  const submit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        startAt: zonedInputToIso(values.startAt),
        endAt: zonedInputToIso(values.endAt),
        reason: values.reason || undefined,
      })
      toast.success('Đã thêm lịch nghỉ')
      reset(EMPTY)
    } catch (e) {
      showServerError(e, setError, { trùng: 'startAt', 'kết thúc': 'endAt' })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Lịch nghỉ</h2>
        </CardTitle>
        <CardDescription>
          Trong thời gian nghỉ, nhân viên không được tính là rảnh. Giờ theo {APP_TIMEZONE}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <FormField id="unavail-start" label="Bắt đầu" error={errors.startAt?.message}>
            <Input
              id="unavail-start"
              type="datetime-local"
              className="h-11"
              aria-invalid={!!errors.startAt}
              aria-describedby={fieldDescribedBy('unavail-start', errors.startAt?.message)}
              {...register('startAt')}
            />
          </FormField>
          <FormField id="unavail-end" label="Kết thúc" error={errors.endAt?.message}>
            <Input
              id="unavail-end"
              type="datetime-local"
              className="h-11"
              aria-invalid={!!errors.endAt}
              aria-describedby={fieldDescribedBy('unavail-end', errors.endAt?.message)}
              {...register('endAt')}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="unavail-reason" label="Lý do (không bắt buộc)" error={errors.reason?.message}>
              <Input
                id="unavail-reason"
                className="h-11"
                aria-invalid={!!errors.reason}
                aria-describedby={fieldDescribedBy('unavail-reason', errors.reason?.message)}
                {...register('reason')}
              />
            </FormField>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" className="h-11 cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? 'Đang thêm...' : 'Thêm lịch nghỉ'}
            </Button>
          </div>
        </form>

        {isPending && <LoadingState />}
        {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && data.length === 0 && (
          <p className="text-muted-foreground">Chưa có lịch nghỉ nào.</p>
        )}
        {data && data.length > 0 && (
          <ul className="grid gap-2">
            {data.map((u) => {
              const range = `${formatDateTime(u.startAt)} → ${formatDateTime(u.endAt)}`
              return (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{range}</p>
                    <p className="text-sm text-muted-foreground">
                      {u.reason ?? 'Không ghi lý do'} · nhập bởi {u.creator.fullName}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="size-11 shrink-0 cursor-pointer"
                    aria-label={`Xóa lịch nghỉ ${range}`}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(u.id, { onSuccess: () => toast.success('Đã xóa lịch nghỉ') })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
