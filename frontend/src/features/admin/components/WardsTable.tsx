import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { WARD_TYPE_LABEL } from '@/features/catalog/units'
import { useUpdateWard, useWards, useZones } from '../hooks'
import type { WardFilters } from '../types'

const PAGE_SIZE = 20

type StatusFilter = 'all' | 'active' | 'inactive'

/** Phường/xã của một tỉnh: lọc, gán khu vực, bật/tắt (Z01). */
export function WardsTable({ provinceId }: { provinceId: number }) {
  const zones = useZones(provinceId)
  const updateWard = useUpdateWard()
  const [zone, setZone] = useState<WardFilters['zone']>(undefined)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const deferredQ = useDeferredValue(q.trim())

  const filters: WardFilters = {
    provinceId,
    zone,
    isActive: status === 'all' ? undefined : status === 'active',
    q: deferredQ,
    page,
    pageSize: PAGE_SIZE,
  }
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useWards(filters)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  // Đổi bộ lọc thì quay về trang 1.
  const onFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(1)
  }

  return (
    <section aria-labelledby="wards-heading" className="grid content-start gap-3">
      <h2 id="wards-heading" className="text-xl font-semibold">
        Phường/xã
      </h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="ward-filter-zone">Khu vực</Label>
          <NativeSelect
            id="ward-filter-zone"
            value={zone === undefined ? '' : String(zone)}
            onChange={(e) =>
              onFilter(setZone)(
                e.target.value === ''
                  ? undefined
                  : e.target.value === 'none'
                    ? 'none'
                    : Number(e.target.value),
              )
            }
          >
            <option value="">Tất cả</option>
            <option value="none">Chưa gán khu vực</option>
            {zones.data?.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ward-filter-status">Trạng thái</Label>
          <NativeSelect
            id="ward-filter-status"
            value={status}
            onChange={(e) => onFilter(setStatus)(e.target.value as StatusFilter)}
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang nhận đặt</option>
            <option value="inactive">Đang tắt</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ward-filter-q">Tìm theo tên</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="ward-filter-q"
              type="search"
              className="h-11 pl-9"
              value={q}
              onChange={(e) => onFilter(setQ)(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">Không có phường/xã phù hợp.</p>
      )}
      {data && data.items.length > 0 && (
        <div
          className={`overflow-x-auto rounded-xl border bg-card ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b bg-secondary text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Tên</th>
                <th scope="col" className="px-4 py-3 font-semibold">Khu vực</th>
                <th scope="col" className="px-4 py-3 font-semibold">Nhận đặt</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((ward) => {
                const label = `${WARD_TYPE_LABEL[ward.type]} ${ward.name}`
                return (
                  <tr key={ward.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">
                        Mã {ward.code}
                        {ward.oldNameHint && ` · ${ward.oldNameHint}`}
                      </p>
                    </td>
                    <td className="px-4 py-2">
                      <NativeSelect
                        aria-label={`Khu vực của ${label}`}
                        value={ward.zone?.id ?? ''}
                        disabled={updateWard.isPending}
                        onChange={(e) =>
                          updateWard.mutate({
                            id: ward.id,
                            zoneId: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">Chưa gán</option>
                        {zones.data?.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-4 py-2">
                      <Switch
                        checked={ward.isActive}
                        // Z01: phải gán khu vực trước khi bật; backend cũng chặn.
                        disabled={!ward.zone || updateWard.isPending}
                        aria-label={`Nhận đặt tại ${label}`}
                        title={ward.zone ? undefined : 'Gán khu vực trước khi bật'}
                        onCheckedChange={(isActive) =>
                          updateWard.mutate({ id: ward.id, isActive })
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <nav
          aria-label="Phân trang phường/xã"
          className="flex items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {data.total} phường/xã · Trang {data.page}/{totalPages}
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
    </section>
  )
}
