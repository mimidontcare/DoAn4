import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { WardsTable } from '../components/WardsTable'
import { ZonesPanel } from '../components/ZonesPanel'
import { useActivateProvince, useProvinces } from '../hooks'

export function AdminAreasPage() {
  const { data: provinces, isPending, isError, error, refetch } = useProvinces()
  const activate = useActivateProvince()
  const [selectedId, setSelectedId] = useState<number>()
  const [confirming, setConfirming] = useState(false)

  if (isPending) return <LoadingState />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  // Mặc định xem tỉnh đang hoạt động.
  const selected =
    provinces.find((p) => p.id === selectedId) ??
    provinces.find((p) => p.isActive) ??
    provinces[0]
  const active = provinces.find((p) => p.isActive)

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Vùng phục vụ</h1>
        <p className="text-muted-foreground">
          Khách chỉ đặt được ở phường/xã đang bật, thuộc khu vực đang bật của tỉnh đang hoạt động.
        </p>
      </div>

      {!selected ? (
        <p className="text-muted-foreground">
          Chưa có tỉnh/thành nào. Nạp dữ liệu vùng bằng lệnh seed ở backend.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
            <div className="grid min-w-60 gap-2">
              <Label htmlFor="province">Tỉnh/thành</Label>
              <NativeSelect
                id="province"
                value={selected.id}
                onChange={(e) => setSelectedId(Number(e.target.value))}
              >
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isActive ? ' (đang hoạt động)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {selected.isActive ? (
              <p className="flex min-h-11 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground">
                Đang hoạt động
              </p>
            ) : (
              <Button
                variant="outline"
                className="h-11 cursor-pointer"
                onClick={() => setConfirming(true)}
              >
                Chuyển sang hoạt động tại tỉnh này
              </Button>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <ZonesPanel provinceId={selected.id} />
            <WardsTable key={selected.id} provinceId={selected.id} />
          </div>

          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Chuyển tỉnh hoạt động?</DialogTitle>
                <DialogDescription>
                  Mỗi thời điểm chỉ một tỉnh hoạt động.
                  {active && ` ${active.name} sẽ ngừng nhận đặt lịch.`} Khách sẽ chỉ đặt được
                  tại {selected.name}.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="h-11 cursor-pointer"
                  onClick={() => setConfirming(false)}
                >
                  Hủy
                </Button>
                <Button
                  className="h-11 cursor-pointer"
                  disabled={activate.isPending}
                  onClick={() =>
                    activate.mutate(selected.id, {
                      onSuccess: () => {
                        toast.success(`Đã chuyển sang ${selected.name}`)
                        setConfirming(false)
                      },
                    })
                  }
                >
                  Xác nhận
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
