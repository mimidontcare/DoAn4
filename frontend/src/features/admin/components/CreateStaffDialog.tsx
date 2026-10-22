import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
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
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { useCreateStaff } from '../hooks'
import { createStaffSchema, type CreateStaffValues } from '../schema'

const EMPTY: CreateStaffValues = { fullName: '', email: '', phone: '', password: '' }
const PASSWORD_HINT = 'Tối thiểu 8 ký tự. Báo mật khẩu này cho nhân viên; họ phải đổi ở lần đăng nhập đầu.'

export function CreateStaffDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const create = useCreateStaff()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (open) reset(EMPTY)
  }, [open, reset])

  const submit = handleSubmit(async (values) => {
    try {
      const staff = await create.mutateAsync(values)
      toast.success('Đã tạo nhân viên')
      onOpenChange(false)
      void navigate(`/admin/staff/${staff.id}`)
    } catch (error) {
      showServerError(error, setError, { email: 'email', 'điện thoại': 'phone' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm nhân viên</DialogTitle>
          <DialogDescription>Sau khi tạo, gán khu vực phục vụ ở trang chi tiết.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <FormField id="staff-name" label="Họ và tên" error={errors.fullName?.message}>
            <Input
              id="staff-name"
              autoComplete="off"
              className="h-11"
              aria-invalid={!!errors.fullName}
              aria-describedby={fieldDescribedBy('staff-name', errors.fullName?.message)}
              {...register('fullName')}
            />
          </FormField>
          <FormField id="staff-email" label="Email đăng nhập" error={errors.email?.message}>
            <Input
              id="staff-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              className="h-11"
              aria-invalid={!!errors.email}
              aria-describedby={fieldDescribedBy('staff-email', errors.email?.message)}
              {...register('email')}
            />
          </FormField>
          <FormField id="staff-phone" label="Số điện thoại" error={errors.phone?.message}>
            <Input
              id="staff-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              className="h-11"
              aria-invalid={!!errors.phone}
              aria-describedby={fieldDescribedBy('staff-phone', errors.phone?.message)}
              {...register('phone')}
            />
          </FormField>
          <FormField
            id="staff-password"
            label="Mật khẩu tạm"
            error={errors.password?.message}
            hint={PASSWORD_HINT}
          >
            <PasswordInput
              id="staff-password"
              autoComplete="new-password"
              className="h-11"
              aria-invalid={!!errors.password}
              aria-describedby={fieldDescribedBy(
                'staff-password',
                errors.password?.message,
                PASSWORD_HINT,
              )}
              {...register('password')}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" className="h-11 cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? 'Đang tạo...' : 'Tạo nhân viên'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
