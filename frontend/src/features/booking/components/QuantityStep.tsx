import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import type { Service } from '@/features/catalog/types'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import { buildQuantitySchema, quantityField, type QuantityValues } from '../schema'
import type { BookingItemInput } from '../types'

interface QuantityStepProps {
  service: Service
  initial: BookingItemInput[]
  onNext: (items: BookingItemInput[]) => void
}

export function QuantityStep({ service, initial, onNext }: QuantityStepProps) {
  const [emptyError, setEmptyError] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuantityValues>({
    resolver: zodResolver(buildQuantitySchema(service.items)),
    mode: 'onTouched',
    defaultValues: Object.fromEntries(
      service.items.map((item) => [
        quantityField(item.id),
        String(initial.find((i) => i.serviceItemId === item.id)?.quantity ?? ''),
      ]),
    ),
  })

  function onSubmit(values: QuantityValues) {
    const items = service.items
      .map((item) => ({
        serviceItemId: item.id,
        quantity: Number(values[quantityField(item.id)] || 0),
      }))
      .filter((item) => item.quantity > 0)
    setEmptyError(items.length === 0)
    if (items.length > 0) onNext(items)
  }

  return (
    <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-5">
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        {service.items.map((item) => {
          const id = quantityField(item.id)
          const error = errors[id]?.message
          const hint = `${formatVnd(item.unitPrice)}/${UNIT_LABEL[item.unit]} · tối đa ${item.maxQty}`
          return (
            <FormField
              key={item.id}
              id={id}
              label={`${item.name} (${UNIT_LABEL[item.unit]})${item.isRequired ? ' *' : ''}`}
              error={error}
              hint={hint}
            >
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                className="h-11"
                aria-invalid={Boolean(error)}
                aria-describedby={fieldDescribedBy(id, error, hint)}
                {...register(id)}
              />
            </FormField>
          )
        })}
      </div>
      {emptyError && (
        <p role="alert" className="text-sm text-destructive">
          Chọn ít nhất một hạng mục.
        </p>
      )}
      <Button type="submit" className="h-11 w-full cursor-pointer sm:w-fit sm:justify-self-end">
        Tiếp tục
      </Button>
    </form>
  )
}
