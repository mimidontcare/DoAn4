import { createBrowserRouter, Navigate } from 'react-router'
import { AddressesPage } from '@/features/account/pages/AddressesPage'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { AdminAreasPage } from '@/features/admin/pages/AdminAreasPage'
import { AdminBlockedDatesPage } from '@/features/admin/pages/AdminBlockedDatesPage'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { AdminReviewsPage } from '@/features/admin/pages/AdminReviewsPage'
import { AdminBookingDetailPage } from '@/features/admin/pages/AdminBookingDetailPage'
import { AdminBookingsPage } from '@/features/admin/pages/AdminBookingsPage'
import { AdminServiceDetailPage } from '@/features/admin/pages/AdminServiceDetailPage'
import { AdminServicesPage } from '@/features/admin/pages/AdminServicesPage'
import { AdminStaffDetailPage } from '@/features/admin/pages/AdminStaffDetailPage'
import { AdminStaffPage } from '@/features/admin/pages/AdminStaffPage'
import { ServiceDetailPage } from '@/features/catalog/pages/ServiceDetailPage'
import { StaffBookingDetailPage } from '@/features/staff/pages/StaffBookingDetailPage'
import { StaffSchedulePage } from '@/features/staff/pages/StaffSchedulePage'
import { ServicesPage } from '@/features/catalog/pages/ServicesPage'
import { BookingDetailPage } from '@/features/booking/pages/BookingDetailPage'
import { BookingWizardPage } from '@/features/booking/pages/BookingWizardPage'
import { MyBookingsPage } from '@/features/booking/pages/MyBookingsPage'
import { AdminLayout } from '@/layouts/AdminLayout'
import { CustomerLayout } from '@/layouts/CustomerLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { StaffLayout } from '@/layouts/StaffLayout'
import { GuestOnly, RequireAuth } from './guards'

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
        children: [
          { index: true, element: <Navigate to="bookings" replace /> },
          { path: 'bookings', element: <MyBookingsPage /> },
          { path: 'bookings/:id', element: <BookingDetailPage /> },
          { path: 'addresses', element: <AddressesPage /> },
        ],
      },
      {
        path: '/book',
        element: <CustomerLayout />,
        children: [{ path: ':slug', element: <BookingWizardPage /> }],
      },
    ],
  },
  {
    element: <RequireAuth roles={['STAFF']} />,
    children: [
      {
        path: '/staff',
        element: <StaffLayout />,
        children: [
          { index: true, element: <StaffSchedulePage /> },
          { path: 'bookings/:id', element: <StaffBookingDetailPage /> },
        ],
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
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'bookings', element: <AdminBookingsPage /> },
          { path: 'reviews', element: <AdminReviewsPage /> },
          { path: 'blocked-dates', element: <AdminBlockedDatesPage /> },
          { path: 'bookings/:id', element: <AdminBookingDetailPage /> },
          { path: 'services', element: <AdminServicesPage /> },
          { path: 'services/:id', element: <AdminServiceDetailPage /> },
          { path: 'areas', element: <AdminAreasPage /> },
          { path: 'staff', element: <AdminStaffPage /> },
          { path: 'staff/:id', element: <AdminStaffDetailPage /> },
        ],
      },
    ],
  },
])
