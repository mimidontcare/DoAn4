import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { AdjustmentProposal } from '@/features/booking/components/AdjustmentProposal'
import { BookingStatusBadge } from '@/features/booking/components/BookingStatusBadge'
import { ConfirmPaymentDialog } from '@/features/booking/components/ConfirmPaymentDialog'
import {
  ACTION_LABEL,
  CANCEL_REASON_LABEL,
  PAYMENT_LABEL,
  PAYMENT_METHOD_LABEL,
} from '@/features/booking/labels'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import { formatDateTime, formatTime } from '@/lib/time'
import { AdminCancelBookingDialog } from '../components/AdminCancelBookingDialog'
import { AssignTeamDialog } from '../components/AssignTeamDialog'
import { useAdminBooking, useConfirmAdminPayment, useRespondAdminAdjustment } from '../hooks'

function BackLink() {
  return (
    <Link
      to="/admin/bookings"
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Đơn đặt lịch
    </Link>
  )
}

export function AdminBookingDetailPage() {
  const id = Number(useParams().id)
  const { data: booking, isPending, isError, error, refetch } = useAdminBooking(id)
  const [assigning, setAssigning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [paying, setPaying] = useState(false)
  const respond = useRespondAdminAdjustment(id)
  const payment = useConfirmAdminPayment(id)

  function onRespond(accept: boolean) {
    respond.mutate(accept, {
      onSuccess: () => toast.success(accept ? 'Đã chấp nhận thay khách' : 'Đã từ chối thay khách'),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

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

  const isOpen = booking.status === 'PENDING' || booking.status === 'CONFIRMED'

  return (
    <article className="grid gap-6">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">{booking.code}</h1>
          <p className="text-muted-foreground">{booking.serviceName}</p>
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span className="text-sm text-muted-foreground">
              {PAYMENT_LABEL[booking.paymentStatus]}
              {booking.paymentMethod && ` · ${PAYMENT_METHOD_LABEL[booking.paymentMethod]}`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {booking.status === 'COMPLETED' && booking.paymentStatus === 'UNPAID' && (
            <Button className="h-11 cursor-pointer" onClick={() => setPaying(true)}>
              Xác nhận thu tiền thay
            </Button>
          )}
          {isOpen && (
            <Button className="h-11 cursor-pointer" onClick={() => setAssigning(true)}>
              {booking.status === 'PENDING' ? 'Phân công' : 'Thay nhóm'}
            </Button>
          )}
          {isOpen && (
            <Button
              variant="outline"
              className="h-11 cursor-pointer text-destructive hover:text-destructive"
              onClick={() => setCancelling(true)}
            >
              Hủy đơn
            </Button>
          )}
        </div>
      </div>

      {booking.proposal && (
        <AdjustmentProposal
          proposal={booking.proposal}
          currentTotal={booking.totalPrice}
          actions={
            <>
              <Button
                variant="outline"
                className="h-11 cursor-pointer"
                disabled={respond.isPending}
                onClick={() => onRespond(false)}
              >
                Khách từ chối
              </Button>
              <Button
                className="h-11 cursor-pointer"
                disabled={respond.isPending}
                onClick={() => onRespond(true)}
              >
                Khách đồng ý (xác nhận thay)
              </Button>
            </>
          }
        />
      )}

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
          <p className="text-muted-foreground">
            Khu vực {booking.zone.name} · {booking.manMinutes} phút công
          </p>
          <p className="break-words">{booking.addressText}</p>
          <p className="text-muted-foreground">
            Liên hệ: {booking.contactName} · {booking.contactPhone}
          </p>
          <p className="text-muted-foreground">
            Khách: {booking.customer.fullName} · {booking.customer.phone} · hủy muộn{' '}
            {booking.customer.lateCancelCount} lần
          </p>
          {booking.note && <p className="break-words">Ghi chú: {booking.note}</p>}
        </section>

        <section aria-labelledby="team-heading" className="grid gap-2 rounded-xl border bg-card p-4">
          <h2 id="team-heading" className="text-lg font-semibold">
            Nhóm nhân viên ({booking.team.length}/{booking.staffCount})
          </h2>
          {booking.team.length === 0 ? (
            <p className="text-muted-foreground">Chưa phân công.</p>
          ) : (
            <ul className="grid gap-1">
              {booking.team.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/admin/staff/${member.id}`}
                    className="text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {member.fullName}
                  </Link>
                  <span className="text-sm text-muted-foreground">{member.phone}</span>
                  {member.isLeader && (
                    <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-medium text-accent-foreground">
                      Trưởng nhóm
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
        <p className="flex justify-between border-t pt-2 text-lg font-semibold">
          <span>Tổng cộng</span>
          <span className="text-primary">{formatVnd(booking.totalPrice)}</span>
        </p>
      </section>

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

      <AssignTeamDialog booking={booking} open={assigning} onOpenChange={setAssigning} />
      <ConfirmPaymentDialog
        code={booking.code}
        total={booking.totalPrice}
        open={paying}
        pending={payment.isPending}
        onOpenChange={setPaying}
        onConfirm={(method) =>
          payment.mutate(method, {
            onSuccess: () => {
              toast.success('Đã xác nhận thu tiền')
              setPaying(false)
            },
            onError: (e) => toast.error(getApiErrorMessage(e)),
          })
        }
      />
      <AdminCancelBookingDialog
        bookingId={booking.id}
        code={booking.code}
        open={cancelling}
        onOpenChange={setCancelling}
      />
    </article>
  )
}
