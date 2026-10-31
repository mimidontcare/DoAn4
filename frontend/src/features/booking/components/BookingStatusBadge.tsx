import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '../labels'
import type { BookingStatus } from '../types'

const STYLE: Record<BookingStatus, string> = {
  PENDING: 'bg-secondary text-secondary-foreground',
  CONFIRMED: 'bg-accent text-accent-foreground',
  IN_PROGRESS: 'bg-primary text-primary-foreground',
  COMPLETED: 'border border-primary text-primary',
  CANCELLED: 'border border-destructive text-destructive',
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-sm font-medium', STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}
