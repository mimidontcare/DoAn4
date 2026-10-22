import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useSaveZone, useZones } from '../hooks'
import type { Zone } from '../types'
import { ZoneDialog } from './ZoneDialog'

/** Khu vực của một tỉnh: thêm, đổi tên, bật/tắt (tắt khu vực thì phường trong đó ngừng nhận đặt). */
export function ZonesPanel({ provinceId }: { provinceId: number }) {
  const { data, isPending, isError, error, refetch } = useZones(provinceId)
  const save = useSaveZone()
  const [editing, setEditing] = useState<{ zone?: Zone } | null>(null)

  const toggle = (zone: Zone, isActive: boolean) =>
    save.mutate(
      { id: zone.id, isActive },
      { onError: (e) => toast.error(getApiErrorMessage(e)) },
    )

  return (
    <section aria-labelledby="zones-heading" className="grid content-start gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="zones-heading" className="text-xl font-semibold">
          Khu vực
        </h2>
        <Button className="h-11 cursor-pointer" onClick={() => setEditing({})}>
          <Plus aria-hidden="true" />
          Thêm
        </Button>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <p className="text-muted-foreground">Tỉnh này chưa có khu vực nào.</p>
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-2">
          {data.map((zone) => (
            <li
              key={zone.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{zone.name}</p>
                <p className="text-sm text-muted-foreground">
                  {zone._count.wards} phường/xã · {zone.isActive ? 'Đang bật' : 'Đang tắt'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={zone.isActive}
                  disabled={save.isPending}
                  aria-label={`Bật khu vực ${zone.name}`}
                  onCheckedChange={(isActive) => toggle(zone, isActive)}
                />
                <Button
                  variant="ghost"
                  className="size-11 cursor-pointer"
                  aria-label={`Đổi tên ${zone.name}`}
                  onClick={() => setEditing({ zone })}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ZoneDialog
        provinceId={provinceId}
        zone={editing?.zone}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </section>
  )
}
