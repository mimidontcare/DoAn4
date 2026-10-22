import { AxiosError } from 'axios'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { formatVnd } from '@/lib/format'
import { ServiceImage } from '../components/ServiceImage'
import { useService } from '../hooks'
import { UNIT_LABEL } from '../units'

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-2 rounded-md text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Tất cả dịch vụ
    </Link>
  )
}

export function ServiceDetailPage() {
  const { slug = '' } = useParams()
  const { data: service, isPending, isError, error, refetch } = useService(slug)

  if (isPending) return <LoadingState />
  if (isError) {
    const notFound = error instanceof AxiosError && error.response?.status === 404
    return (
      <div className="grid gap-4">
        <BackLink />
        {notFound ? (
          <p className="py-8 text-center text-muted-foreground">
            Dịch vụ không tồn tại hoặc đã ngừng cung cấp.
          </p>
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }

  return (
    <article className="grid gap-6">
      <BackLink />
      <div className="grid gap-6 md:grid-cols-[2fr_3fr] md:items-start">
        <ServiceImage
          url={service.imageUrl}
          alt={service.name}
          className="aspect-[4/3] w-full rounded-xl border"
        />
        <div className="grid gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{service.name}</h1>
          {service.description && (
            <p className="whitespace-pre-line text-muted-foreground">
              {service.description}
            </p>
          )}
          {service.minCharge > 0 && (
            <p>
              Giá tối thiểu mỗi đơn:{' '}
              <span className="font-semibold text-primary">
                {formatVnd(service.minCharge)}
              </span>
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="price-heading" className="grid gap-3">
        <h2 id="price-heading" className="text-xl font-semibold">
          Bảng giá
        </h2>
        {service.items.length === 0 ? (
          <p className="text-muted-foreground">Dịch vụ chưa có hạng mục giá.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[480px] text-left">
              <thead className="border-b bg-secondary text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Hạng mục</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Đơn giá</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Khối lượng</th>
                </tr>
              </thead>
              <tbody>
                {service.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      {item.name}
                      {item.isRequired && (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-medium">
                          Bắt buộc
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatVnd(item.unitPrice)}/{UNIT_LABEL[item.unit]}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                      {item.minQty > 0 ? `${item.minQty}–${item.maxQty}` : `tối đa ${item.maxQty}`}{' '}
                      {UNIT_LABEL[item.unit]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Giá lúc đặt là giá tạm tính; khối lượng thực tế được kiểm tra khi nhân viên đến.
        </p>
      </section>
    </article>
  )
}
