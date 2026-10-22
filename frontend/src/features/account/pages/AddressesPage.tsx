import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { WARD_TYPE_LABEL } from '@/features/catalog/units'
import { AddressDialog } from '../components/AddressDialog'
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../hooks'
import type { Address } from '../types'

function addressLine(a: Address) {
  return [a.detail, `${WARD_TYPE_LABEL[a.ward.type]} ${a.ward.name}`, a.ward.provinceName].join(
    ', ',
  )
}

export function AddressesPage() {
  const { data, isPending, isError, error, refetch } = useAddresses()
  const setDefault = useSetDefaultAddress()
  const remove = useDeleteAddress()
  const [editing, setEditing] = useState<{ address?: Address } | null>(null)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Địa chỉ của tôi</h1>
          <p className="text-muted-foreground">Địa chỉ mặc định được chọn sẵn khi đặt lịch.</p>
        </div>
        <Button className="h-11 cursor-pointer" onClick={() => setEditing({})}>
          <Plus aria-hidden="true" />
          Thêm địa chỉ
        </Button>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-10 text-center">
          <MapPin aria-hidden="true" className="size-8 text-primary" />
          <p className="text-muted-foreground">Bạn chưa lưu địa chỉ nào.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-3">
          {data.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{address.label ?? 'Địa chỉ'}</p>
                  {address.isDefault && (
                    <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-medium text-accent-foreground">
                      Mặc định
                    </span>
                  )}
                  {!address.isServiceable && (
                    <span className="rounded-md border border-destructive px-2 py-0.5 text-sm font-medium text-destructive">
                      Ngoài vùng phục vụ
                    </span>
                  )}
                </div>
                <p>{addressLine(address)}</p>
                <p className="text-sm text-muted-foreground">
                  {address.contactName} · {address.contactPhone}
                </p>
                {!address.isServiceable && (
                  <p className="text-sm text-destructive">
                    Phường/xã này đã ngừng phục vụ, không dùng để đặt lịch được. Sửa lại phường hoặc
                    dùng địa chỉ khác.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                {!address.isDefault && (
                  <Button
                    variant="ghost"
                    className="h-11 cursor-pointer"
                    disabled={setDefault.isPending}
                    onClick={() => setDefault.mutate(address.id)}
                  >
                    <Star aria-hidden="true" />
                    Đặt mặc định
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="size-11 cursor-pointer"
                  aria-label={`Sửa ${addressLine(address)}`}
                  onClick={() => setEditing({ address })}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="size-11 cursor-pointer text-destructive hover:text-destructive"
                  aria-label={`Xóa ${addressLine(address)}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(address.id, { onSuccess: () => toast.success('Đã xóa địa chỉ') })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressDialog
        address={editing?.address}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  )
}
