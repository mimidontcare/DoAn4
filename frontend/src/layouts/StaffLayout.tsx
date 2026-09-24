import { Outlet } from 'react-router'

export function StaffLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b px-6 py-3 font-semibold">Staff</header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
