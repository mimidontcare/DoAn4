import { Outlet } from 'react-router'
import { AppHeader } from '@/components/common/AppHeader'

export function AdminLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader area="Quản trị" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
