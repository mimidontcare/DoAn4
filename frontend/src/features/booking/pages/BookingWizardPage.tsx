import { useState } from 'react'
import { useParams } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { useService } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'
import { AddressStep } from '../components/AddressStep'
import { QuantityStep } from '../components/QuantityStep'
import { ScheduleStep } from '../components/ScheduleStep'
import type { BookingItemInput } from '../types'

const STEPS = ['Khối lượng', 'Địa chỉ', 'Ngày giờ'] as const

export function BookingWizardPage() {
  const { slug = '' } = useParams()
  const { data: service, isPending, isError, error, refetch } = useService(slug)
  const [step, setStep] = useState(0)
  const [items, setItems] = useState<BookingItemInput[]>([])
  const [addressId, setAddressId] = useState<number | null>(null)

  if (isPending) return <LoadingState />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-bold">Đặt lịch</h1>
        <p className="text-muted-foreground">{service.name}</p>
      </div>

      <ol className="flex gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={cn(
              'flex-1 border-t-2 pt-2 text-sm font-medium',
              index <= step
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground',
            )}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <QuantityStep
          service={service}
          initial={items}
          onNext={(next) => {
            setItems(next)
            setStep(1)
          }}
        />
      )}
      {step === 1 && (
        <AddressStep
          selectedId={addressId}
          onBack={() => setStep(0)}
          onNext={(id) => {
            setAddressId(id)
            setStep(2)
          }}
        />
      )}
      {step === 2 && addressId !== null && (
        <ScheduleStep
          serviceId={service.id}
          addressId={addressId}
          items={items}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  )
}
