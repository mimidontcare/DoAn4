import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Hiển thị điểm 1–5 bằng sao; số điểm đọc được bằng trình đọc màn hình. */
export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${value} trên 5 sao`}
      className={cn('inline-flex gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(
            'size-4',
            star <= Math.round(value) ? 'fill-primary text-primary' : 'text-muted-foreground',
          )}
        />
      ))}
    </span>
  )
}
