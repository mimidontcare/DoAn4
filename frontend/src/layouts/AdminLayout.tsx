import { MapPinned, Tags } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { AppHeader } from '@/components/common/AppHeader'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin/services', label: 'Dịch vụ', icon: Tags },
  { to: '/admin/areas', label: 'Vùng phục vụ', icon: MapPinned },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader area="Quản trị" />
      <nav aria-label="Quản trị" className="border-b bg-card">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
