import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import { formatDateTime, formatTime } from '@/lib/time'
import { BookingStatusBadge } from '../components/BookingStatusBadge'
import { CancelBookingDialog } from '../components/CancelBookingDialog'
import { useBooking } from '../hooks'
import { ACTION_LABEL, CANCEL_REASON_LABEL, PAYMENT_LABEL } from '../labels'

function BackLink() {
  return (
    <Link
      to="/account/bookings"
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Đơn của tôi
    </Link>
  )
}

export function BookingDetailPage() {
  const id = Number(useParams().id)
  const { data: booking, isPending, isError, error, refetch } = useBooking(id)
  const [cancelling, setCancelling] = useState(false)

  if (!Number.isInteger(id) || id <= 0) {
    return <p className="py-8 text-center text-muted-foreground">Không tìm thấy đơn.</p>
  }
  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="grid gap-4">
        <BackLink />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED'

  return (
    <article className="grid gap-6">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">{booking.serviceName}</h1>
          <p className="text-muted-foreground">Mã đơn {booking.code}</p>
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span className="text-sm text-muted-foreground">
              {PAYMENT_LABEL[booking.paymentStatus]}
            </span>
          </div>
        </div>
        {canCancel && (
          <Button
            variant="outline"
            className="h-11 cursor-pointer text-destructive hover:text-destructive"
            onClick={() => setCancelling(true)}
          >
            Hủy đơn
          </Button>
        )}
      </div>

      {booking.status === 'CANCELLED' && booking.cancelReason && (
        <p className="rounded-xl border border-destructive bg-card p-4">
          {CANCEL_REASON_LABEL[booking.cancelReason]}
          {booking.cancelledAt && ` lúc ${formatDateTime(booking.cancelledAt)}`}
          {booking.cancelNote && `: ${booking.cancelNote}`}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <section aria-labelledby="schedule-heading" className="grid gap-2 rounded-xl border bg-card p-4">
          <h2 id="schedule-heading" className="text-lg font-semibold">
            Lịch làm việc
          </h2>
          <p>
            {formatDateTime(booking.startAt)} – {formatTime(booking.endAt)}
          </p>
          <p className="text-muted-foreground">{booking.staffCount} nhân viên</p>
          <p className="break-words">{booking.addressText}</p>
          <p className="text-muted-foreground">
            {booking.contactName} · {booking.contactPhone}
          </p>
          {booking.note && <p className="break-words">Ghi chú: {booking.note}</p>}
        </section>

        <section aria-labelledby="price-heading" className="grid gap-2 rounded-xl border bg-card p-4">
          <h2 id="price-heading" className="text-lg font-semibold">
            Giá tạm tính
          </h2>
          <ul className="grid gap-1">
            {booking.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.nameSnapshot} × {item.quantity} {UNIT_LABEL[item.unit]}
                </span>
                <span className="whitespace-nowrap">{formatVnd(item.amount)}</span>
              </li>
            ))}
          </ul>
          {booking.subtotal > booking.itemsTotal && (
            <p className="text-sm text-muted-foreground">
              Áp dụng mức tối thiểu: {formatVnd(booking.subtotal)}
            </p>
          )}
          <p className="flex justify-between border-t pt-2 text-lg font-semibold">
            <span>Tổng cộng</span>
            <span className="text-primary">{formatVnd(booking.totalPrice)}</span>
          </p>
        </section>
      </div>

      <section aria-labelledby="history-heading" className="grid gap-3 rounded-xl border bg-card p-4">
        <h2 id="history-heading" className="text-lg font-semibold">
          Lịch sử
        </h2>
        <ol className="grid gap-2">
          {booking.histories.map((history) => (
            <li key={history.id} className="flex flex-wrap justify-between gap-x-4">
              <span>
                {ACTION_LABEL[history.action]}
                {history.note && ` — ${history.note}`}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDateTime(history.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <CancelBookingDialog
        bookingId={booking.id}
        code={booking.code}
        open={cancelling}
        onOpenChange={setCancelling}
      />
    </article>
  )
}
