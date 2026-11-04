import { zodResolver } from '@hookform/resolvers/zod'
import { Star } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useCreateReview } from '../hooks'
import { reviewSchema, type ReviewValues } from '../schema'

/** V01: đánh giá một lần, không sửa được sau khi gửi. */
export function ReviewForm({ bookingId, deadline }: { bookingId: number; deadline: string }) {
  const create = useCreateReview(bookingId)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: '' },
  })
  const commentError = errors.comment?.message

  function onSubmit({ rating, comment }: ReviewValues) {
    create.mutate(
      { rating, comment: comment || undefined },
      {
        onSuccess: () => toast.success('Cảm ơn bạn đã đánh giá'),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    )
  }

  return (
    <section
      aria-labelledby="review-heading"
      className="grid gap-3 rounded-xl border-2 border-primary bg-card p-4"
    >
      <div className="grid gap-1">
        <h2 id="review-heading" className="text-lg font-semibold">
          Đánh giá dịch vụ
        </h2>
        <p className="text-sm text-muted-foreground">
          Đánh giá trước {formatDateTime(deadline)}. Đánh giá đã gửi không sửa được.
        </p>
      </div>
      <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4">
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-sm font-medium">Số sao</legend>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <label
                    key={star}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
                  >
                    <input
                      type="radio"
                      name="rating"
                      className="sr-only"
                      checked={field.value === star}
                      onChange={() => field.onChange(star)}
                    />
                    <Star
                      aria-hidden="true"
                      className={cn(
                        'size-7 transition-colors',
                        star <= field.value ? 'fill-primary text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <span className="sr-only">{star} sao</span>
                  </label>
                ))}
              </div>
              {errors.rating && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.rating.message}
                </p>
              )}
            </fieldset>
          )}
        />
        <FormField id="review-comment" label="Nhận xét" error={commentError}>
          <Textarea
            id="review-comment"
            rows={3}
            aria-invalid={Boolean(commentError)}
            aria-describedby={fieldDescribedBy('review-comment', commentError)}
            {...register('comment')}
          />
        </FormField>
        <Button
          type="submit"
          className="h-11 w-full cursor-pointer sm:w-fit sm:justify-self-end"
          disabled={create.isPending}
        >
          {create.isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
        </Button>
      </form>
    </section>
  )
}
