import { createBrowserRouter } from 'react-router'
import { HealthStatus } from '@/features/health/HealthStatus'
import { AdminLayout } from '@/layouts/AdminLayout'
import { CustomerLayout } from '@/layouts/CustomerLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StaffLayout } from '@/layouts/StaffLayout'

// Route guard theo role được thêm ở Phase 1; hiện các khu vực còn là placeholder.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [{ index: true, element: <HealthStatus /> }],
  },
  {
    path: '/account',
    element: <CustomerLayout />,
    children: [{ index: true, element: <p>Khu vực khách hàng</p> }],
  },
  {
    path: '/staff',
    element: <StaffLayout />,
    children: [{ index: true, element: <p>Khu vực nhân viên</p> }],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [{ index: true, element: <p>Khu vực quản trị</p> }],
  },
])
