import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import { ServiceForm } from '../components/ServiceForm'
import { ServiceItemDialog } from '../components/ServiceItemDialog'
import {
  useAdminService,
  useSetServiceActive,
  useSetServiceItemActive,
  useUpdateService,
} from '../hooks'
import type { AdminServiceItem } from '../types'

export function AdminServiceDetailPage() {
  const id = Number(useParams().id)
  const { data: service, isPending, isError, error, refetch } = useAdminService(id)
  const update = useUpdateService(id)
  const setActive = useSetServiceActive()
  const setItemActive = useSetServiceItemActive(id)
  // null: đóng; undefined trong object: thêm mới.
  const [editing, setEditing] = useState<{ item?: AdminServiceItem } | null>(null)

  if (isPending) return <LoadingState />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  return (
    <div className="grid gap-6">
      <Link
        to="/admin/services"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Danh sách dịch vụ
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{service.name}</h1>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <Switch
            checked={service.isActive}
            disabled={setActive.isPending}
            onCheckedChange={(isActive) => setActive.mutate({ id, isActive })}
          />
          {service.isActive ? 'Đang bán' : 'Đang tắt'}
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">Thông tin dịch vụ</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceForm
            // Đổi key khi dữ liệu server đổi để form nhận giá trị mới.
            key={service.updatedAt}
            submitLabel="Lưu thay đổi"
            defaultValues={{
              name: service.name,
              slug: service.slug,
              description: service.description ?? '',
              imageUrl: service.imageUrl ?? '',
              minCharge: service.minCharge,
              sortOrder: service.sortOrder,
            }}
            onSubmit={async (input) => {
              await update.mutateAsync(input)
              toast.success('Đã lưu dịch vụ')
            }}
          />
        </CardContent>
      </Card>

      <section aria-labelledby="items-heading" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="items-heading" className="text-xl font-semibold">
            Hạng mục giá
          </h2>
          <Button className="h-11 cursor-pointer" onClick={() => setEditing({})}>
            <Plus aria-hidden="true" />
            Thêm hạng mục
          </Button>
        </div>
        {service.items.length === 0 ? (
          <p className="text-muted-foreground">Chưa có hạng mục nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b bg-secondary text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Hạng mục</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Đơn giá</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Phút công</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Khối lượng</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Bật</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {service.items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 ${item.isActive ? '' : 'text-muted-foreground'}`}
                  >
                    <td className="px-4 py-3">
                      {item.name}
                      {item.isRequired && (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                          Bắt buộc
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatVnd(item.unitPrice)}/{UNIT_LABEL[item.unit]}
                    </td>
                    <td className="px-4 py-3 text-right">{item.minutesPerUnit}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {item.minQty}–{item.maxQty} {UNIT_LABEL[item.unit]}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={item.isActive}
                        disabled={setItemActive.isPending}
                        aria-label={`Bật hạng mục ${item.name}`}
                        onCheckedChange={(isActive) =>
                          setItemActive.mutate({ itemId: item.id, isActive })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        className="size-11 cursor-pointer"
                        aria-label={`Sửa ${item.name}`}
                        onClick={() => setEditing({ item })}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ServiceItemDialog
        serviceId={id}
        item={editing?.item}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  )
}
