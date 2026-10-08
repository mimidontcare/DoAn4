import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthShell } from '../components/AuthShell'
import { fieldDescribedBy } from '../components/field-a11y'
import { FormField } from '../components/FormField'
import { PasswordInput } from '../components/PasswordInput'
import { showServerError } from '../errors'
import { useRegister } from '../hooks'
import { registerSchema } from '../schema'

const PASSWORD_HINT = 'Tối thiểu 8 ký tự.'

// Đăng ký xong backend trả luôn cặp token; GuestOnly tự chuyển vào khu vực khách hàng.
export function RegisterPage() {
  const [params] = useSearchParams()
  const registerAccount = useRegister()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerAccount.mutateAsync({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      })
    } catch (error) {
      showServerError(error, setError, {
        email: 'email',
        'điện thoại': 'phone',
      })
    }
  })

  const redirect = params.get('redirect')
  const loginLink = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : '/login'

  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Đăng ký miễn phí để đặt lịch vệ sinh tại nhà."
      footer={
        <p>
          Đã có tài khoản?{' '}
          <Link
            to={loginLink}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
        <FormField id="fullName" label="Họ và tên" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            className="h-11"
            aria-invalid={!!errors.fullName}
            aria-describedby={fieldDescribedBy('fullName', errors.fullName?.message)}
            {...register('fullName')}
          />
        </FormField>
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className="h-11"
            aria-invalid={!!errors.email}
            aria-describedby={fieldDescribedBy('email', errors.email?.message)}
            {...register('email')}
          />
        </FormField>
        <FormField id="phone" label="Số điện thoại" error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            className="h-11"
            aria-invalid={!!errors.phone}
            aria-describedby={fieldDescribedBy('phone', errors.phone?.message)}
            {...register('phone')}
          />
        </FormField>
        <FormField
          id="password"
          label="Mật khẩu"
          error={errors.password?.message}
          hint={PASSWORD_HINT}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.password}
            aria-describedby={fieldDescribedBy(
              'password',
              errors.password?.message,
              PASSWORD_HINT,
            )}
            {...register('password')}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label="Nhập lại mật khẩu"
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
          disabled={registerAccount.isPending}
        >
          {registerAccount.isPending ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </Button>
      </form>
    </AuthShell>
  )
}
