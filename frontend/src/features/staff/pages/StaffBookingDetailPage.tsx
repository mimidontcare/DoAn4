import { ArrowLeft, Phone } from 'lucide-react'
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
import type { PaymentMethod } from '@/features/booking/types'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import { formatDateTime, formatTime, formatWeekday } from '@/lib/time'
import * as api from '../api'
import { DeclineDialog } from '../components/DeclineDialog'
import { ProposeAdjustmentDialog } from '../components/ProposeAdjustmentDialog'
import { useStaffAction, useStaffBooking } from '../hooks'

function BackLink() {
  return (
    <Link
      to="/staff"
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Lịch làm việc
    </Link>
  )
}

type Dialog = 'decline' | 'adjust' | 'payment' | null

export function StaffBookingDetailPage() {
  const id = Number(useParams().id)
  const { data: booking, isPending, isError, error, refetch } = useStaffBooking(id)
  const [dialog, setDialog] = useState<Dialog>(null)
  const notify = (message: string) => ({
    onSuccess: () => toast.success(message),
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  })
  const checkIn = useStaffAction(id, () => api.checkIn(id))
  const complete = useStaffAction(id, () => api.complete(id))
  const noShow = useStaffAction(id, () => api.reportNoShow(id))
  const payment = useStaffAction(id, (method: PaymentMethod) => api.confirmPayment(id, method))
  const busy = checkIn.isPending || complete.isPending || noShow.isPending

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

  const { status, isLeader } = booking
  const pendingProposal = booking.adjustmentStatus === 'PENDING'

  return (
    <article className="grid gap-5">
      <BackLink />
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold">
          {formatTime(booking.startAt)} – {formatTime(booking.endAt)}
        </h1>
        <p className="text-muted-foreground">
          {formatWeekday(booking.startAt)} · {booking.serviceName} · {booking.code}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={status} />
          <span className="text-sm text-muted-foreground">
            {PAYMENT_LABEL[booking.paymentStatus]}
            {booking.paymentMethod && ` · ${PAYMENT_METHOD_LABEL[booking.paymentMethod]}`}
          </span>
        </div>
      </div>

      {/* Nút theo vai trò và trạng thái; backend vẫn kiểm tra lại mọi rule. */}
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {isLeader && status === 'CONFIRMED' && (
          <Button
            className="h-12 cursor-pointer text-base"
            disabled={busy}
            onClick={() => checkIn.mutate(undefined, notify('Đã check-in, bắt đầu làm việc'))}
          >
            Check-in
          </Button>
        )}
        {isLeader && status === 'IN_PROGRESS' && !pendingProposal && (
          <Button
            variant="outline"
            className="h-12 cursor-pointer text-base"
            onClick={() => setDialog('adjust')}
          >
            Đề xuất điều chỉnh
          </Button>
        )}
        {isLeader && status === 'IN_PROGRESS' && (
          <Button
            className="h-12 cursor-pointer text-base"
            disabled={busy || pendingProposal}
            onClick={() => complete.mutate(undefined, notify('Đã hoàn thành'))}
          >
            Hoàn thành
          </Button>
        )}
        {isLeader && status === 'COMPLETED' && booking.paymentStatus === 'UNPAID' && (
          <Button className="h-12 cursor-pointer text-base" onClick={() => setDialog('payment')}>
            Xác nhận đã thu tiền
          </Button>
        )}
        {isLeader && status === 'CONFIRMED' && (
          <Button
            variant="outline"
            className="h-12 cursor-pointer text-base"
            disabled={busy}
            onClick={() => noShow.mutate(undefined, notify('Đã báo khách vắng mặt'))}
          >
            Báo khách vắng mặt
          </Button>
        )}
        {status === 'CONFIRMED' && (
          <Button
            variant="ghost"
            className="h-12 cursor-pointer text-base text-destructive hover:text-destructive"
            onClick={() => setDialog('decline')}
          >
            Từ chối việc
          </Button>
        )}
      </div>
      {pendingProposal && isLeader && status === 'IN_PROGRESS' && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang chờ khách xác nhận đề xuất; xác nhận xong mới hoàn thành được.
        </p>
      )}

      {booking.proposal && (
        <AdjustmentProposal proposal={booking.proposal} currentTotal={booking.totalPrice} />
      )}

      {status === 'CANCELLED' && booking.cancelReason && (
        <p className="rounded-xl border border-destructive bg-card p-4">
          {CANCEL_REASON_LABEL[booking.cancelReason]}
          {booking.cancelNote && `: ${booking.cancelNote}`}
        </p>
      )}

      <section
        aria-labelledby="customer-heading"
        className="grid gap-2 rounded-xl border bg-card p-4"
      >
        <h2 id="customer-heading" className="text-lg font-semibold">
          Khách hàng
        </h2>
        <p className="break-words">{booking.addressText}</p>
        <a
          href={`tel:${booking.contactPhone}`}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Phone aria-hidden="true" className="size-4" />
          {booking.contactName} · {booking.contactPhone}
        </a>
        {booking.note && <p className="break-words">Ghi chú: {booking.note}</p>}
      </section>

      <section aria-labelledby="work-heading" className="grid gap-2 rounded-xl border bg-card p-4">
        <h2 id="work-heading" className="text-lg font-semibold">
          Khối lượng ({booking.manMinutes} phút công)
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
          <span>Cần thu</span>
          <span className="text-primary">{formatVnd(booking.totalPrice)}</span>
        </p>
      </section>

      <section aria-labelledby="team-heading" className="grid gap-2 rounded-xl border bg-card p-4">
        <h2 id="team-heading" className="text-lg font-semibold">
          Nhóm
        </h2>
        <ul className="grid gap-1">
          {booking.team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              {m.fullName}
              <a
                href={`tel:${m.phone}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {m.phone}
              </a>
              {m.isLeader && (
                <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-medium text-accent-foreground">
                  Trưởng nhóm
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="history-heading"
        className="grid gap-2 rounded-xl border bg-card p-4"
      >
        <h2 id="history-heading" className="text-lg font-semibold">
          Lịch sử
        </h2>
        <ol className="grid gap-2">
          {booking.histories.map((h) => (
            <li key={h.id} className="flex flex-wrap justify-between gap-x-4">
              <span>
                {ACTION_LABEL[h.action]}
                {h.note && ` — ${h.note}`}
              </span>
              <span className="text-sm text-muted-foreground">{formatDateTime(h.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      <DeclineDialog
        bookingId={booking.id}
        code={booking.code}
        isLeader={isLeader}
        open={dialog === 'decline'}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      {isLeader && (
        <ProposeAdjustmentDialog
          booking={booking}
          open={dialog === 'adjust'}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      <ConfirmPaymentDialog
        code={booking.code}
        total={booking.totalPrice}
        open={dialog === 'payment'}
        pending={payment.isPending}
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(method) =>
          payment.mutate(method, {
            onSuccess: () => {
              toast.success('Đã xác nhận thu tiền')
              setDialog(null)
            },
            onError: (e) => toast.error(getApiErrorMessage(e)),
          })
        }
      />
    </article>
  )
}
