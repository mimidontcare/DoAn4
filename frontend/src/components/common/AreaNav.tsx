import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

export interface AreaNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Thanh tab dưới header của một khu vực (quản trị, khách hàng...). */
export function AreaNav({ label, items }: { label: string; items: AreaNavItem[] }) {
  return (
    <nav aria-label={label} className="border-b bg-card">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
        {items.map(({ to, label: text, icon: Icon }) => (
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
              {text}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
