import { Link } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { RatingStars } from '@/components/common/RatingStars'
import { BookingStatusBadge } from '@/features/booking/components/BookingStatusBadge'
import type { BookingStatus } from '@/features/booking/types'
import { formatVnd } from '@/lib/format'
import { useDashboard } from '../hooks'

const ATTENTION: {
  key: 'unassigned' | 'overdueCheckIn' | 'pendingAdjustments' | 'unpaid'
  label: string
  to: string
}[] = [
  { key: 'unassigned', label: 'Chờ phân công', to: '/admin/bookings?status=PENDING' },
  {
    key: 'overdueCheckIn',
    label: 'Quá giờ chưa check-in',
    to: '/admin/bookings?overdueCheckIn=true',
  },
  {
    key: 'pendingAdjustments',
    label: 'Điều chỉnh chờ khách xác nhận',
    to: '/admin/bookings?status=IN_PROGRESS',
  },
  {
    key: 'unpaid',
    label: 'Hoàn thành, chưa thu tiền',
    to: '/admin/bookings?status=COMPLETED&paymentStatus=UNPAID',
  },
]

/** A08: dashboard rút gọn. */
export function AdminDashboardPage() {
  const { data, isPending, isError, error, refetch } = useDashboard()

  if (isPending) return <LoadingState />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  const [year, month] = data.month.split('-')

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Tổng quan</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <section
          aria-labelledby="revenue-heading"
          className="grid gap-1 rounded-xl border bg-card p-4"
        >
          <h2 id="revenue-heading" className="text-sm font-medium text-muted-foreground">
            Doanh thu tháng {month}/{year}
          </h2>
          <p className="text-3xl font-bold text-primary">{formatVnd(data.revenue.total)}</p>
          <p className="text-sm text-muted-foreground">{data.revenue.paidCount} đơn đã thu tiền</p>
        </section>
        <section
          aria-labelledby="rating-heading"
          className="grid gap-1 rounded-xl border bg-card p-4"
        >
          <h2 id="rating-heading" className="text-sm font-medium text-muted-foreground">
            Điểm đánh giá trung bình
          </h2>
          {data.rating.average === null ? (
            <p className="text-lg">Chưa có đánh giá</p>
          ) : (
            <p className="flex items-center gap-3">
              <span className="text-3xl font-bold">{data.rating.average.toFixed(1)}</span>
              <RatingStars value={data.rating.average} />
            </p>
          )}
          <p className="text-sm text-muted-foreground">{data.rating.count} đánh giá</p>
        </section>
      </div>

      <section aria-labelledby="attention-heading" className="grid gap-3">
        <h2 id="attention-heading" className="text-lg font-semibold">
          Cần xử lý
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ATTENTION.map(({ key, label, to }) => (
            <li key={key}>
              <Link
                to={to}
                className={`grid gap-1 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 ${data.attention[key] > 0 ? 'border-primary' : ''}`}
              >
                <span className="text-3xl font-bold">{data.attention[key]}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="status-heading" className="grid gap-3">
        <h2 id="status-heading" className="text-lg font-semibold">
          Đơn theo trạng thái
        </h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-left">
            <thead className="border-b bg-secondary text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Trạng thái
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Số đơn
                </th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(data.statusCounts) as [BookingStatus, number][]).map(
                ([status, count]) => (
                  <tr key={status} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{count}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
