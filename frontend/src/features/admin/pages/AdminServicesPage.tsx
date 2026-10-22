import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { formatVnd } from '@/lib/format'
import { ServiceForm } from '../components/ServiceForm'
import { useAdminServices, useCreateService, useSetServiceActive } from '../hooks'

export function AdminServicesPage() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const { data, isPending, isError, error, refetch } = useAdminServices()
  const create = useCreateService()
  const setActive = useSetServiceActive()

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dịch vụ và bảng giá</h1>
          <p className="text-muted-foreground">
            Dịch vụ không xóa được, chỉ tắt; dịch vụ đang tắt không hiện với khách.
          </p>
        </div>
        <Button className="h-11 cursor-pointer" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          Thêm dịch vụ
        </Button>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <p className="text-muted-foreground">Chưa có dịch vụ nào.</p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b bg-secondary text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Dịch vụ</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Giá tối thiểu</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Hạng mục</th>
                <th scope="col" className="px-4 py-3 font-semibold">Đang bán</th>
              </tr>
            </thead>
            <tbody>
              {data.map((service) => (
                <tr key={service.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/services/${service.id}`}
                      className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {service.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">/{service.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatVnd(service.minCharge)}
                  </td>
                  <td className="px-4 py-3 text-right">{service._count.items}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={service.isActive}
                      disabled={setActive.isPending}
                      aria-label={`Đang bán: ${service.name}`}
                      onCheckedChange={(isActive) =>
                        setActive.mutate({ id: service.id, isActive })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm dịch vụ</DialogTitle>
            <DialogDescription>Sau khi tạo, thêm các hạng mục giá ở trang chi tiết.</DialogDescription>
          </DialogHeader>
          <ServiceForm
            submitLabel="Tạo dịch vụ"
            onSubmit={async (input) => {
              const created = await create.mutateAsync(input)
              toast.success('Đã tạo dịch vụ')
              setCreating(false)
              void navigate(`/admin/services/${created.id}`)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
