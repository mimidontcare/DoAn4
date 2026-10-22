import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Lock, LockOpen } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { StaffStatusBadge } from '../components/StaffStatusBadge'
import { StaffZonesCard } from '../components/StaffZonesCard'
import { UnavailabilitiesCard } from '../components/UnavailabilitiesCard'
import { useSetUserLocked, useStaff, useUpdateStaff } from '../hooks'
import { updateStaffSchema, type UpdateStaffValues } from '../schema'
import type { Staff } from '../types'

function StaffInfoCard({ staff }: { staff: Staff }) {
  const update = useUpdateStaff(staff.id)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateStaffValues>({
    resolver: zodResolver(updateStaffSchema),
    mode: 'onTouched',
    defaultValues: { fullName: staff.fullName, phone: staff.phone },
  })

  const submit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values)
      toast.success('Đã lưu thông tin')
    } catch (error) {
      showServerError(error, setError, { 'điện thoại': 'phone' })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Thông tin</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Email đăng nhập: </span>
            {staff.email}
          </p>
          <FormField id="staff-edit-name" label="Họ và tên" error={errors.fullName?.message}>
            <Input
              id="staff-edit-name"
              className="h-11"
              aria-invalid={!!errors.fullName}
              aria-describedby={fieldDescribedBy('staff-edit-name', errors.fullName?.message)}
              {...register('fullName')}
            />
          </FormField>
          <FormField id="staff-edit-phone" label="Số điện thoại" error={errors.phone?.message}>
            <Input
              id="staff-edit-phone"
              type="tel"
              inputMode="numeric"
              className="h-11"
              aria-invalid={!!errors.phone}
              aria-describedby={fieldDescribedBy('staff-edit-phone', errors.phone?.message)}
              {...register('phone')}
            />
          </FormField>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="h-11 cursor-pointer"
              disabled={!isDirty || isSubmitting}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function AdminStaffDetailPage() {
  const id = Number(useParams().id)
  const { data: staff, isPending, isError, error, refetch } = useStaff(id)
  const setLocked = useSetUserLocked()

  if (isPending) return <LoadingState />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  const locked = staff.status === 'LOCKED'

  return (
    <div className="grid gap-6">
      <Link
        to="/admin/staff"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Danh sách nhân viên
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{staff.fullName}</h1>
          <StaffStatusBadge staff={staff} />
        </div>
        <Button
          variant={locked ? 'outline' : 'destructive'}
          className="h-11 cursor-pointer"
          disabled={setLocked.isPending}
          onClick={() =>
            setLocked.mutate(
              { id: staff.id, locked: !locked },
              { onSuccess: () => toast.success(locked ? 'Đã mở khóa' : 'Đã khóa tài khoản') },
            )
          }
        >
          {locked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {locked ? 'Mở khóa' : 'Khóa tài khoản'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* key: nạp lại form khi dữ liệu server đổi. */}
        <StaffInfoCard key={`${staff.fullName}|${staff.phone}`} staff={staff} />
        <StaffZonesCard key={staff.zones.map((z) => z.id).join(',')} staff={staff} />
      </div>
      <UnavailabilitiesCard staffId={staff.id} />
    </div>
  )
}
