import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { formatVnd } from '@/lib/format'
import { formatDateTime } from '@/lib/time'
import { BookingStatusBadge } from '../components/BookingStatusBadge'
import { useMyBookings } from '../hooks'
import { STATUS_LABEL } from '../labels'
import type { BookingStatus } from '../types'

const STATUSES = Object.keys(STATUS_LABEL) as BookingStatus[]

export function MyBookingsPage() {
  const [status, setStatus] = useState<BookingStatus | ''>('')
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error, refetch } = useMyBookings({
    status: status || undefined,
    page,
  })
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Đơn của tôi</h1>
          <p className="text-muted-foreground">Theo dõi các lịch đã đặt.</p>
        </div>
        <div className="grid w-full gap-2 sm:w-56">
          <Label htmlFor="status-filter">Trạng thái</Label>
          <NativeSelect
            id="status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as BookingStatus | '')
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-10 text-center">
          <ClipboardList aria-hidden="true" className="size-8 text-primary" />
          <p className="text-muted-foreground">Chưa có đơn nào.</p>
          <Link to="/" className={buttonVariants({ variant: 'cta', className: 'h-11' })}>
            Xem dịch vụ
          </Link>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="grid gap-3">
          {data.items.map((booking) => (
            <li key={booking.id}>
              <Link
                to={`/account/bookings/${booking.id}`}
                className="grid gap-1 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{booking.serviceName}</span>
                  <BookingStatusBadge status={booking.status} />
                </span>
                <span>{formatDateTime(booking.startAt)}</span>
                <span className="text-sm break-words text-muted-foreground">
                  {booking.addressText}
                </span>
                <span className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{booking.code}</span>
                  <span className="font-semibold text-primary">
                    {formatVnd(booking.totalPrice)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && pageCount > 1 && (
        <nav aria-label="Phân trang" className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="h-11 cursor-pointer"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {page}/{pageCount}
          </span>
          <Button
            variant="outline"
            className="h-11 cursor-pointer"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </nav>
      )}
    </div>
  )
}
