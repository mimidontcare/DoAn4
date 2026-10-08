import type { AuthUser, UserRole } from './types'

/** Khu vực mặc định của từng role sau khi đăng nhập. */
export const ROLE_HOME: Record<UserRole, string> = {
  CUSTOMER: '/account',
  STAFF: '/staff',
  ADMIN: '/admin',
}

/**
 * Trang đích sau khi đăng nhập: quay về trang đang xem dở nếu là đường dẫn nội bộ
 * và thuộc quyền của role; ngược lại về khu vực của role. Chặn open redirect (//evil.com).
 */
export function resolvePostLoginPath(
  user: AuthUser,
  redirect: string | null,
): string {
  if (user.mustChangePassword) {
    return '/change-password'
  }
  // Trình duyệt hiểu "/\evil.com" giống "//evil.com".
  if (redirect && /^\/(?![/\\])/.test(redirect)) {
    const otherArea = (Object.keys(ROLE_HOME) as UserRole[]).some(
      (role) =>
        role !== user.role &&
        (redirect === ROLE_HOME[role] ||
          redirect.startsWith(`${ROLE_HOME[role]}/`)),
    )
    if (!otherArea && !redirect.startsWith('/login')) {
      return redirect
    }
  }
  return ROLE_HOME[user.role]
}
