import { MapPin } from 'lucide-react'
import { Outlet } from 'react-router'
import { AppHeader } from '@/components/common/AppHeader'
import { AreaNav, type AreaNavItem } from '@/components/common/AreaNav'

const NAV: AreaNavItem[] = [{ to: '/account/addresses', label: 'Địa chỉ', icon: MapPin }]

export function CustomerLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader area="Khách hàng" />
      <AreaNav label="Tài khoản" items={NAV} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
