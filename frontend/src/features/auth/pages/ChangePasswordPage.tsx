import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth.store'
import { AuthShell } from '../components/AuthShell'
import { fieldDescribedBy } from '../components/field-a11y'
import { FormField } from '../components/FormField'
import { PasswordInput } from '../components/PasswordInput'
import { showServerError } from '../errors'
import { useChangePassword, useLogout } from '../hooks'
import { ROLE_HOME } from '../roles'
import { changePasswordSchema } from '../schema'

const NEW_PASSWORD_HINT = 'Tối thiểu 8 ký tự, khác mật khẩu hiện tại.'

/**
 * Bắt buộc ở lần đăng nhập đầu của tài khoản do hệ thống tạo (U01);
 * cũng dùng để đổi mật khẩu thông thường.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate()
  const mustChange = useAuthStore((s) => s.user?.mustChangePassword ?? false)
  const changePassword = useChangePassword()
  const logout = useLogout()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      toast.success('Đã đổi mật khẩu')
      navigate(ROLE_HOME[result.user.role], { replace: true })
    } catch (error) {
      showServerError(error, setError, {
        'hiện tại không đúng': 'currentPassword',
        'mật khẩu mới': 'newPassword',
      })
    }
  })

  return (
    <AuthShell
      title="Đổi mật khẩu"
      description={
        mustChange
          ? 'Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu mới để tiếp tục.'
          : 'Sau khi đổi, các thiết bị khác sẽ bị đăng xuất.'
      }
      footer={
        <Button
          type="button"
          variant="link"
          className="h-11 cursor-pointer"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Đăng xuất
        </Button>
      }
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        <FormField
          id="currentPassword"
          label="Mật khẩu hiện tại"
          error={errors.currentPassword?.message}
        >
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            className="h-11"
            aria-invalid={!!errors.currentPassword}
            aria-describedby={fieldDescribedBy(
              'currentPassword',
              errors.currentPassword?.message,
            )}
            {...register('currentPassword')}
          />
        </FormField>
        <FormField
          id="newPassword"
          label="Mật khẩu mới"
          error={errors.newPassword?.message}
          hint={NEW_PASSWORD_HINT}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.newPassword}
            aria-describedby={fieldDescribedBy(
              'newPassword',
              errors.newPassword?.message,
              NEW_PASSWORD_HINT,
            )}
            {...register('newPassword')}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label="Nhập lại mật khẩu mới"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={fieldDescribedBy(
              'confirmPassword',
              errors.confirmPassword?.message,
            )}
            {...register('confirmPassword')}
          />
        </FormField>
        <Button
          type="submit"
          className="h-11 w-full cursor-pointer"
          disabled={changePassword.isPending}
        >
          {changePassword.isPending ? 'Đang lưu...' : 'Đổi mật khẩu'}
        </Button>
      </form>
    </AuthShell>
  )
}
