import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { RatingStars } from '@/components/common/RatingStars'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDateTime } from '@/lib/time'
import { useAdminReviews, useSetReviewHidden } from '../hooks'

const PAGE_SIZE = 20

/** V03: admin xem và ẩn đánh giá không phù hợp; đánh giá ẩn không tính điểm. */
export function AdminReviewsPage() {
  const [hidden, setHidden] = useState<boolean>()
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminReviews({
    hidden,
    page,
    pageSize: PAGE_SIZE,
  })
  const setReviewHidden = useSetReviewHidden()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Đánh giá</h1>
        <p className="text-muted-foreground">
          Đánh giá bị ẩn không hiện ở trang dịch vụ và không tính vào điểm trung bình.
        </p>
      </div>
      <div className="grid gap-2 sm:w-56">
        <Label htmlFor="review-filter">Hiển thị</Label>
        <NativeSelect
          id="review-filter"
          value={hidden === undefined ? '' : String(hidden)}
          onChange={(e) => {
            setHidden(e.target.value === '' ? undefined : e.target.value === 'true')
            setPage(1)
          }}
        >
          <option value="">Tất cả</option>
          <option value="false">Đang hiện</option>
          <option value="true">Đã ẩn</option>
        </NativeSelect>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">Không có đánh giá.</p>
      )}
      {data && data.items.length > 0 && (
        <ul className={`grid gap-3 ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {data.items.map((review) => (
            <li
              key={review.id}
              className={`flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between ${review.isHidden ? 'opacity-70' : ''}`}
            >
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars value={review.rating} />
                  {review.isHidden && (
                    <span className="rounded-md border border-destructive px-2 py-0.5 text-sm text-destructive">
                      Đã ẩn
                    </span>
                  )}
                </div>
                {review.comment && (
                  <p className="break-words whitespace-pre-line">{review.comment}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {review.customer.fullName} ·{' '}
                  <Link
                    to={`/admin/bookings/${review.booking.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {review.booking.code}
                  </Link>{' '}
                  · {review.booking.serviceName} · {formatDateTime(review.createdAt)}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-11 shrink-0 cursor-pointer"
                disabled={setReviewHidden.isPending}
                onClick={() =>
                  setReviewHidden.mutate(
                    { id: review.id, hidden: !review.isHidden },
                    {
                      onSuccess: () =>
                        toast.success(review.isHidden ? 'Đã hiện lại đánh giá' : 'Đã ẩn đánh giá'),
                      onError: (e) => toast.error(getApiErrorMessage(e)),
                    },
                  )
                }
              >
                {review.isHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                {review.isHidden ? 'Hiện lại' : 'Ẩn'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {data && data.total > 0 && (
        <nav aria-label="Phân trang đánh giá" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.total} đánh giá · Trang {data.page}/{totalPages}
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
