import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { AddressDialog } from '@/features/account/components/AddressDialog'
import { useAddresses } from '@/features/account/hooks'
import { WARD_TYPE_LABEL } from '@/features/catalog/units'
import { cn } from '@/lib/utils'

interface AddressStepProps {
  selectedId: number | null
  onBack: () => void
  onNext: (addressId: number) => void
}

export function AddressStep({ selectedId, onBack, onNext }: AddressStepProps) {
  const { data, isPending, isError, error, refetch } = useAddresses()
  const [picked, setPicked] = useState(selectedId)
  const [adding, setAdding] = useState(false)

  const usable = data?.filter((address) => address.isServiceable) ?? []
  const chosen =
    usable.find((address) => address.id === picked) ??
    usable.find((address) => address.isDefault) ??
    usable[0]

  return (
    <div className="grid gap-5">
      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
          Bạn chưa có địa chỉ nào. Thêm địa chỉ để tiếp tục.
        </p>
      )}
      {data && data.length > 0 && (
        <fieldset className="grid gap-3">
          <legend className="sr-only">Chọn địa chỉ làm việc</legend>
          {data.map((address) => (
            <label
              key={address.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors',
                address.isServiceable ? 'cursor-pointer hover:bg-accent' : 'opacity-70',
                chosen?.id === address.id && 'border-primary',
              )}
            >
              <input
                type="radio"
                name="address"
                className="mt-1 size-4 accent-primary"
                checked={chosen?.id === address.id}
                disabled={!address.isServiceable}
                onChange={() => setPicked(address.id)}
              />
              <span className="grid gap-1">
                <span className="font-semibold">{address.label ?? 'Địa chỉ'}</span>
                <span>
                  {address.detail}, {WARD_TYPE_LABEL[address.ward.type]} {address.ward.name},{' '}
                  {address.ward.provinceName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {address.contactName} · {address.contactPhone}
                </span>
                {!address.isServiceable && (
                  <span className="text-sm text-destructive">Ngoài vùng phục vụ</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <Button
        variant="outline"
        className="h-11 w-fit cursor-pointer"
        onClick={() => setAdding(true)}
      >
        <Plus aria-hidden="true" />
        Thêm địa chỉ
      </Button>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="h-11 cursor-pointer" onClick={onBack}>
          Quay lại
        </Button>
        <Button
          className="h-11 cursor-pointer"
          disabled={!chosen}
          onClick={() => chosen && onNext(chosen.id)}
        >
          Tiếp tục
        </Button>
      </div>

      <AddressDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
