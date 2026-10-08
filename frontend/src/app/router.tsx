import { createBrowserRouter } from 'react-router'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { HealthStatus } from '@/features/health/HealthStatus'
import { AdminLayout } from '@/layouts/AdminLayout'
import { CustomerLayout } from '@/layouts/CustomerLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StaffLayout } from '@/layouts/StaffLayout'
import { GuestOnly, RequireAuth } from './guards'

// Nội dung từng khu vực còn là placeholder, được thay ở các phase sau.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [{ index: true, element: <HealthStatus /> }],
  },
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth allowPendingPasswordChange />,
    children: [{ path: '/change-password', element: <ChangePasswordPage /> }],
  },
  {
    element: <RequireAuth roles={['CUSTOMER']} />,
    children: [
      {
        path: '/account',
        element: <CustomerLayout />,
        children: [{ index: true, element: <p>Khu vực khách hàng</p> }],
      },
    ],
  },
  {
    element: <RequireAuth roles={['STAFF']} />,
    children: [
      {
        path: '/staff',
        element: <StaffLayout />,
        children: [{ index: true, element: <p>Khu vực nhân viên</p> }],
      },
    ],
  },
  {
    element: <RequireAuth roles={['ADMIN']} />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [{ index: true, element: <p>Khu vực quản trị</p> }],
      },
    ],
  },
])
