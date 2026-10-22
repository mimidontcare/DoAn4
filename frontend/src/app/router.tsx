import { createBrowserRouter, Navigate } from 'react-router'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { AdminAreasPage } from '@/features/admin/pages/AdminAreasPage'
import { AdminServiceDetailPage } from '@/features/admin/pages/AdminServiceDetailPage'
import { AdminServicesPage } from '@/features/admin/pages/AdminServicesPage'
import { ServiceDetailPage } from '@/features/catalog/pages/ServiceDetailPage'
import { ServicesPage } from '@/features/catalog/pages/ServicesPage'
import { AdminLayout } from '@/layouts/AdminLayout'
import { CustomerLayout } from '@/layouts/CustomerLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StaffLayout } from '@/layouts/StaffLayout'
import { GuestOnly, RequireAuth } from './guards'

// Khu vực khách hàng và nhân viên còn là placeholder, được thay ở các phase sau.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <ServicesPage /> },
      { path: 'services/:slug', element: <ServiceDetailPage /> },
    ],
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
        children: [
          { index: true, element: <Navigate to="services" replace /> },
          { path: 'services', element: <AdminServicesPage /> },
          { path: 'services/:id', element: <AdminServiceDetailPage /> },
          { path: 'areas', element: <AdminAreasPage /> },
        ],
      },
    ],
  },
])
