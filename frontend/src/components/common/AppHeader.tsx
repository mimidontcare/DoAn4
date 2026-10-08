import { LogOut, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/hooks'
import { useAuthStore } from '@/stores/auth.store'

const linkClass =
  'rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** Header dùng chung cho 4 layout: tên khu vực, người dùng hiện tại, đăng nhập/đăng xuất. */
export function AppHeader({ area }: { area?: string }) {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className={`flex items-center gap-2 font-semibold text-primary ${linkClass}`}
          >
            <Sparkles aria-hidden="true" className="size-5" />
            <span className="hidden sm:inline">Vệ sinh tại nhà</span>
          </Link>
          {area && (
            <span className="truncate rounded-md bg-accent px-2 py-1 text-sm font-medium text-accent-foreground">
              {area}
            </span>
          )}
        </div>

        {user ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm md:inline">{user.fullName}</span>
            <Button
              variant="ghost"
              className="h-11 cursor-pointer"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut aria-hidden="true" />
              Đăng xuất
            </Button>
          </div>
        ) : (
          <nav aria-label="Tài khoản" className="flex items-center gap-2">
            <Button asChild variant="ghost" className="h-11">
              <Link to="/login">Đăng nhập</Link>
            </Button>
            <Button asChild className="h-11">
              <Link to="/register">Đăng ký</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  )
}
