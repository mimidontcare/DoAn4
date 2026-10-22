import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { CreateStaffDialog } from '../components/CreateStaffDialog'
import { StaffStatusBadge } from '../components/StaffStatusBadge'
import { useAllZones, useStaffList } from '../hooks'
import type { Staff, StaffFilters } from '../types'

const PAGE_SIZE = 20

export function AdminStaffPage() {
  const zones = useAllZones()
  const [creating, setCreating] = useState(false)
  const [zoneId, setZoneId] = useState<number>()
  const [status, setStatus] = useState<Staff['status']>()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const deferredQ = useDeferredValue(q.trim())

  const filters: StaffFilters = { zoneId, status, q: deferredQ, page, pageSize: PAGE_SIZE }
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useStaffList(filters)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nhân viên</h1>
          <p className="text-muted-foreground">
            Nhân viên chỉ được gợi ý phân công ở những khu vực đã gán.
          </p>
        </div>
        <Button className="h-11 cursor-pointer" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          Thêm nhân viên
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="staff-filter-zone">Khu vực</Label>
          <NativeSelect
            id="staff-filter-zone"
            value={zoneId ?? ''}
            onChange={(e) => {
              setZoneId(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {zones.data?.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="staff-filter-status">Trạng thái</Label>
          <NativeSelect
            id="staff-filter-status"
            value={status ?? ''}
            onChange={(e) => {
              setStatus((e.target.value || undefined) as Staff['status'] | undefined)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="staff-filter-q">Tìm theo tên, email, SĐT</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="staff-filter-q"
              type="search"
              className="h-11 pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">Không có nhân viên phù hợp.</p>
      )}
      {data && data.items.length > 0 && (
        <div
          className={`overflow-x-auto rounded-xl border bg-card ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b bg-secondary text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Nhân viên</th>
                <th scope="col" className="px-4 py-3 font-semibold">Liên hệ</th>
                <th scope="col" className="px-4 py-3 font-semibold">Khu vực</th>
                <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((staff) => (
                <tr key={staff.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/staff/${staff.id}`}
                      className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {staff.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <p>{staff.phone}</p>
                    <p className="text-muted-foreground">{staff.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {staff.zones.length === 0 ? (
                      <span className="text-muted-foreground">Chưa gán</span>
                    ) : (
                      staff.zones.map((z) => z.name).join(', ')
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StaffStatusBadge staff={staff} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <nav aria-label="Phân trang nhân viên" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.total} nhân viên · Trang {data.page}/{totalPages}
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

      <CreateStaffDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
