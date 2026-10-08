import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { resolvePostLoginPath, ROLE_HOME } from '@/features/auth/roles'
import type { UserRole } from '@/features/auth/types'
import { useAuthStore } from '@/stores/auth.store'

function FullScreenLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center text-muted-foreground"
    >
      Đang tải...
    </div>
  )
}

interface RequireAuthProps {
  /** Bỏ trống: mọi role đã đăng nhập đều vào được. */
  roles?: UserRole[]
  /** Trang đổi mật khẩu: vào được khi đang bị bắt đổi mật khẩu. */
  allowPendingPasswordChange?: boolean
}

/**
 * Chặn route theo trạng thái đăng nhập và role. Chỉ để trải nghiệm tốt hơn:
 * backend vẫn kiểm tra quyền ở mọi API.
 */
export function RequireAuth({ roles, allowPendingPasswordChange }: RequireAuthProps) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (status === 'initializing') {
    return <FullScreenLoader />
  }
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to="/change-password" replace />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />
  }
  return <Outlet />
}

/** Trang đăng nhập/đăng ký: đã đăng nhập thì chuyển đi (về trang đang xem dở nếu hợp lệ). */
export function GuestOnly() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const [params] = useSearchParams()

  if (status === 'initializing') {
    return <FullScreenLoader />
  }
  if (user) {
    return <Navigate to={resolvePostLoginPath(user, params.get('redirect'))} replace />
  }
  return <Outlet />
}
