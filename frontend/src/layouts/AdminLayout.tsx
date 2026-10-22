import { MapPinned, Tags, Users } from 'lucide-react'
import { Outlet } from 'react-router'
import { AppHeader } from '@/components/common/AppHeader'
import { AreaNav, type AreaNavItem } from '@/components/common/AreaNav'

const NAV: AreaNavItem[] = [
  { to: '/admin/services', label: 'Dịch vụ', icon: Tags },
  { to: '/admin/areas', label: 'Vùng phục vụ', icon: MapPinned },
  { to: '/admin/staff', label: 'Nhân viên', icon: Users },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader area="Quản trị" />
      <AreaNav label="Quản trị" items={NAV} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
