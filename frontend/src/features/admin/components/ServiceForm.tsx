import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { formatVnd } from '@/lib/format'
import { serviceSchema, type ServiceValues } from '../schema'
import type { ServiceInput } from '../types'
import { ImageUploadField } from './ImageUploadField'

const EMPTY: ServiceValues = {
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  minCharge: 0,
  sortOrder: 0,
}

const SLUG_HINT = 'Dùng trong đường dẫn trang dịch vụ. Bỏ trống khi tạo mới để tự sinh từ tên.'

interface ServiceFormProps {
  defaultValues?: ServiceValues
  submitLabel: string
  onSubmit: (input: ServiceInput) => Promise<unknown>
}

/**
 * Form tạo/sửa dịch vụ. Chuỗi rỗng gửi lên nghĩa là xóa giá trị (mô tả, ảnh);
 * slug rỗng khi tạo thì backend tự sinh.
 */
export function ServiceForm({ defaultValues = EMPTY, submitLabel, onSubmit }: ServiceFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    mode: 'onTouched',
    defaultValues,
  })
  const minCharge = useWatch({ control, name: 'minCharge' })
  const minChargeHint = Number.isFinite(minCharge) ? formatVnd(minCharge) : undefined

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({ ...values, slug: values.slug || undefined })
    } catch (error) {
      showServerError(error, setError, { slug: 'slug' })
    }
  })

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <FormField id="service-name" label="Tên dịch vụ" error={errors.name?.message}>
        <Input
          id="service-name"
          className="h-11"
          aria-invalid={!!errors.name}
          aria-describedby={fieldDescribedBy('service-name', errors.name?.message)}
          {...register('name')}
        />
      </FormField>
      <FormField
        id="service-slug"
        label="Slug"
        error={errors.slug?.message}
        hint={SLUG_HINT}
      >
        <Input
          id="service-slug"
          className="h-11"
          aria-invalid={!!errors.slug}
          aria-describedby={fieldDescribedBy('service-slug', errors.slug?.message, SLUG_HINT)}
          {...register('slug')}
        />
      </FormField>
      <FormField
        id="service-description"
        label="Mô tả"
        error={errors.description?.message}
      >
        <Textarea
          id="service-description"
          rows={4}
          aria-invalid={!!errors.description}
          aria-describedby={fieldDescribedBy(
            'service-description',
            errors.description?.message,
          )}
          {...register('description')}
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="service-min-charge"
          label="Giá tối thiểu mỗi đơn (VND)"
          error={errors.minCharge?.message}
          hint={minChargeHint}
        >
          <Input
            id="service-min-charge"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            className="h-11"
            aria-invalid={!!errors.minCharge}
            aria-describedby={fieldDescribedBy(
              'service-min-charge',
              errors.minCharge?.message,
              minChargeHint,
            )}
            {...register('minCharge', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          id="service-sort"
          label="Thứ tự hiển thị"
          error={errors.sortOrder?.message}
        >
          <Input
            id="service-sort"
            type="number"
            inputMode="numeric"
            min={0}
            className="h-11"
            aria-invalid={!!errors.sortOrder}
            aria-describedby={fieldDescribedBy('service-sort', errors.sortOrder?.message)}
            {...register('sortOrder', { valueAsNumber: true })}
          />
        </FormField>
      </div>
      <Controller
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <ImageUploadField value={field.value} onChange={field.onChange} />
        )}
      />
      <div className="flex justify-end">
        <Button type="submit" className="h-11 cursor-pointer" disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
