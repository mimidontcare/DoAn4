import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAllZones, useProvinces, useSetStaffZones } from '../hooks'
import type { Staff } from '../types'

/** Chọn nhiều khu vực, nhóm theo tỉnh; lưu là thay toàn bộ danh sách. */
export function StaffZonesCard({ staff }: { staff: Staff }) {
  const zones = useAllZones()
  const provinces = useProvinces()
  const save = useSetStaffZones(staff.id)
  const [selected, setSelected] = useState(() => new Set(staff.zones.map((z) => z.id)))

  const saved = new Set(staff.zones.map((z) => z.id))
  const dirty =
    selected.size !== saved.size || [...selected].some((id) => !saved.has(id))

  const toggle = (id: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Khu vực phục vụ</h2>
        </CardTitle>
        <CardDescription>Một nhân viên có thể phục vụ nhiều khu vực.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {(zones.isPending || provinces.isPending) && <LoadingState />}
        {zones.isError && <ErrorState error={zones.error} onRetry={() => void zones.refetch()} />}
        {zones.data && provinces.data && zones.data.length === 0 && (
          <p className="text-muted-foreground">Chưa có khu vực nào. Tạo ở trang Vùng phục vụ.</p>
        )}
        {zones.data &&
          provinces.data?.map((province) => {
            const inProvince = zones.data.filter((z) => z.provinceId === province.id)
            if (inProvince.length === 0) return null
            return (
              <fieldset key={province.id} className="grid gap-1">
                <legend className="mb-1 font-medium">
                  {province.name}
                  {province.isActive && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (đang hoạt động)
                    </span>
                  )}
                </legend>
                <div className="grid gap-1 sm:grid-cols-2">
                  {inProvince.map((zone) => (
                    <label
                      key={zone.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        className="size-5 cursor-pointer accent-primary"
                        checked={selected.has(zone.id)}
                        onChange={(e) => toggle(zone.id, e.target.checked)}
                      />
                      <span>
                        {zone.name}
                        {!zone.isActive && (
                          <span className="ml-1 text-sm text-muted-foreground">(đang tắt)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
        <div className="flex justify-end">
          <Button
            className="h-11 cursor-pointer"
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate([...selected], { onSuccess: () => toast.success('Đã lưu khu vực') })
            }
          >
            {save.isPending ? 'Đang lưu...' : 'Lưu khu vực'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
