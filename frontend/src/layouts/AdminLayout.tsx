import { CalendarOff, ClipboardList, LayoutDashboard, MapPinned, Star, Tags, Users } from 'lucide-react'
import { Outlet } from 'react-router'
import { AppHeader } from '@/components/common/AppHeader'
import { AreaNav, type AreaNavItem } from '@/components/common/AreaNav'

const NAV: AreaNavItem[] = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/admin/bookings', label: 'Đơn đặt lịch', icon: ClipboardList },
  { to: '/admin/reviews', label: 'Đánh giá', icon: Star },
  { to: '/admin/services', label: 'Dịch vụ', icon: Tags },
  { to: '/admin/areas', label: 'Vùng phục vụ', icon: MapPinned },
  { to: '/admin/staff', label: 'Nhân viên', icon: Users },
  { to: '/admin/blocked-dates', label: 'Ngày nghỉ', icon: CalendarOff },
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
