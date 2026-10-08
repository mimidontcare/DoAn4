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
import { useLogin } from '../hooks'
import { loginSchema } from '../schema'

// Đăng nhập thành công thì GuestOnly tự chuyển trang (về trang đang xem dở hoặc khu vực của role).
export function LoginPage() {
  const [params] = useSearchParams()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
    } catch (error) {
      showServerError(error, setError)
    }
  })

  const redirect = params.get('redirect')
  const registerLink = redirect
    ? `/register?redirect=${encodeURIComponent(redirect)}`
    : '/register'

  return (
    <AuthShell
      title="Đăng nhập"
      description="Đăng nhập để đặt lịch và theo dõi đơn của bạn."
      footer={
        <p>
          Chưa có tài khoản?{' '}
          <Link
            to={registerLink}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Đăng ký
          </Link>
        </p>
      }
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-5">
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
        <FormField id="password" label="Mật khẩu" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className="h-11"
            aria-invalid={!!errors.password}
            aria-describedby={fieldDescribedBy('password', errors.password?.message)}
            {...register('password')}
          />
        </FormField>
        <Button
          type="submit"
          className="h-11 w-full cursor-pointer"
          disabled={login.isPending}
        >
          {login.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
    </AuthShell>
  )
}
