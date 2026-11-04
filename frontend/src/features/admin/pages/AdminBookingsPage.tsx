import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { BookingStatusBadge } from '@/features/booking/components/BookingStatusBadge'
import { PAYMENT_LABEL, STATUS_LABEL } from '@/features/booking/labels'
import type { BookingStatus, PaymentStatus } from '@/features/booking/types'
import { formatVnd } from '@/lib/format'
import { formatDateTime } from '@/lib/time'
import { useAdminBookings } from '../hooks'

const PAGE_SIZE = 20
const STATUSES = Object.keys(STATUS_LABEL) as BookingStatus[]

export function AdminBookingsPage() {
  // Bộ lọc nằm trên URL để các ô "Cần xử lý" ở trang Tổng quan dẫn thẳng tới đây.
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') || undefined) as BookingStatus | undefined
  const paymentStatus = (params.get('paymentStatus') || undefined) as PaymentStatus | undefined
  const overdueCheckIn = params.get('overdueCheckIn') === 'true'
  const page = Number(params.get('page')) || 1
  const [q, setQ] = useState('')
  const deferredQ = useDeferredValue(q.trim())

  /** Đổi bộ lọc thì về trang 1. */
  function update(changes: Record<string, string | undefined>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  const setPage = (fn: (p: number) => number) => update({ page: String(fn(page)) })

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminBookings({
    status,
    paymentStatus,
    overdueCheckIn,
    q: deferredQ,
    page,
    pageSize: PAGE_SIZE,
  })
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Đơn đặt lịch</h1>
        <p className="text-muted-foreground">Đơn sắp đến giờ được xếp lên trước.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="booking-filter-status">Trạng thái</Label>
          <NativeSelect
            id="booking-filter-status"
            value={status ?? ''}
            disabled={overdueCheckIn}
            onChange={(e) => update({ status: e.target.value || undefined })}
          >
            <option value="">Tất cả</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="booking-filter-q">Tìm theo mã đơn</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="booking-filter-q"
              type="search"
              className="h-11 pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                update({})
              }}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="booking-filter-payment">Thanh toán</Label>
          <NativeSelect
            id="booking-filter-payment"
            value={paymentStatus ?? ''}
            onChange={(e) => update({ paymentStatus: e.target.value || undefined })}
          >
            <option value="">Tất cả</option>
            {(Object.keys(PAYMENT_LABEL) as PaymentStatus[]).map((value) => (
              <option key={value} value={value}>
                {PAYMENT_LABEL[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={overdueCheckIn}
            onChange={(e) =>
              update({ overdueCheckIn: e.target.checked ? 'true' : undefined, status: undefined })
            }
          />
          Quá giờ chưa check-in
        </label>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">Không có đơn phù hợp.</p>
      )}
      {data && data.items.length > 0 && (
        <div
          className={`overflow-x-auto rounded-xl border bg-card ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b bg-secondary text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Mã đơn</th>
                <th scope="col" className="px-4 py-3 font-semibold">Dịch vụ, khách</th>
                <th scope="col" className="px-4 py-3 font-semibold">Giờ bắt đầu</th>
                <th scope="col" className="px-4 py-3 font-semibold">Nhóm</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
                <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((booking) => (
                <tr key={booking.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/bookings/${booking.id}`}
                      className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {booking.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <p>{booking.serviceName}</p>
                    <p className="text-muted-foreground">{booking.customer.fullName}</p>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {formatDateTime(booking.startAt)}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {booking.assignedCount}/{booking.staffCount}
                  </td>
                  <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                    {formatVnd(booking.totalPrice)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <nav aria-label="Phân trang đơn" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.total} đơn · Trang {data.page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="size-11 cursor-pointer"
              aria-label="Trang trước"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              className="size-11 cursor-pointer"
              aria-label="Trang sau"
              disabled={page >= totalPages || isPlaceholderData}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
