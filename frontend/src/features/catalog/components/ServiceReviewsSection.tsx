import { useState } from 'react'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { RatingStars } from '@/components/common/RatingStars'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/time'
import { useServiceReviews } from '../hooks'

/** C05: đánh giá công khai của dịch vụ (không gồm đánh giá bị ẩn). */
export function ServiceReviewsSection({ serviceId }: { serviceId: number }) {
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useServiceReviews(
    serviceId,
    page,
  )
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <section aria-labelledby="reviews-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-heading" className="text-xl font-semibold">
          Đánh giá
        </h2>
        {data?.average != null && (
          <span className="flex items-center gap-2">
            <RatingStars value={data.average} />
            <span className="font-semibold">{data.average.toFixed(1)}</span>
            <span className="text-muted-foreground">({data.total} đánh giá)</span>
          </span>
        )}
      </div>
      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.total === 0 && (
        <p className="text-muted-foreground">Dịch vụ chưa có đánh giá.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className={`grid gap-3 ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {data.items.map((review) => (
            <li key={review.id} className="grid gap-1 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{review.customerName}</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              <RatingStars value={review.rating} />
              {review.comment && (
                <p className="break-words whitespace-pre-line">{review.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="h-11 cursor-pointer"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Mới hơn
          </Button>
          <span className="text-sm">
            Trang {page}/{totalPages}
          </span>
          <Button
            variant="outline"
            className="h-11 cursor-pointer"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => setPage((p) => p + 1)}
          >
            Cũ hơn
          </Button>
        </div>
      )}
    </section>
  )
}
