import { ChevronLeft, ChevronRight, Crown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { BookingStatusBadge } from '@/features/booking/components/BookingStatusBadge'
import { dateInZone, formatDay, formatTime, formatWeekday } from '@/lib/time'
import { useSchedule } from '../hooks'
import type { StaffBookingSummary } from '../types'

const DAYS_PER_PAGE = 7

/** Nhóm theo ngày bắt đầu (theo múi giờ nghiệp vụ). */
function groupByDay(bookings: StaffBookingSummary[]) {
  const groups = new Map<string, StaffBookingSummary[]>()
  for (const booking of bookings) {
    const day = formatWeekday(booking.startAt)
    groups.set(day, [...(groups.get(day) ?? []), booking])
  }
  return [...groups.entries()]
}

export function StaffSchedulePage() {
  const [offset, setOffset] = useState(0)
  const from = dateInZone(offset)
  const to = dateInZone(offset + DAYS_PER_PAGE - 1)
  const { data, isPending, isError, error, refetch } = useSchedule(from, to)

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold">Lịch làm việc</h1>
        <p className="text-muted-foreground">
          {formatDay(from)} – {formatDay(to)}
        </p>
      </div>
      <nav aria-label="Chọn tuần" className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="h-11 cursor-pointer"
          onClick={() => setOffset((o) => o - DAYS_PER_PAGE)}
        >
          <ChevronLeft aria-hidden="true" />
          Tuần trước
        </Button>
        {offset !== 0 && (
          <Button variant="ghost" className="h-11 cursor-pointer" onClick={() => setOffset(0)}>
            Hôm nay
          </Button>
        )}
        <Button
          variant="outline"
          className="h-11 cursor-pointer"
          onClick={() => setOffset((o) => o + DAYS_PER_PAGE)}
        >
          Tuần sau
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <p className="rounded-xl border bg-card py-10 text-center text-muted-foreground">
          Không có lịch trong tuần này.
        </p>
      )}
      {data &&
        groupByDay(data).map(([day, bookings]) => (
          <section key={day} aria-label={day} className="grid gap-2">
            <h2 className="font-semibold">{day}</h2>
            <ul className="grid gap-2">
              {bookings.map((booking) => (
                <li key={booking.id}>
                  <Link
                    to={`/staff/bookings/${booking.id}`}
                    className="grid gap-1 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-lg font-semibold">
                        {formatTime(booking.startAt)} – {formatTime(booking.endAt)}
                      </span>
                      <BookingStatusBadge status={booking.status} />
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {booking.serviceName}
                      {booking.isLeader && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-sm font-medium text-accent-foreground">
                          <Crown aria-hidden="true" className="size-3.5" />
                          Trưởng nhóm
                        </span>
                      )}
                    </span>
                    <span className="text-sm break-words text-muted-foreground">
                      {booking.addressText}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
