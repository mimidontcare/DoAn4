import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { formatVnd } from '@/lib/format'
import type { Service } from '../types'
import { UNIT_LABEL } from '../units'
import { ServiceImage } from './ServiceImage'

/** Đơn giá thấp nhất trong các hạng mục, để hiện "Từ ...". */
function lowestPrice(service: Service) {
  return service.items.reduce<Service['items'][number] | null>(
    (lowest, item) => (!lowest || item.unitPrice < lowest.unitPrice ? item : lowest),
    null,
  )
}

export function ServiceCard({ service }: { service: Service }) {
  const lowest = lowestPrice(service)
  return (
    <Link
      to={`/services/${service.slug}`}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition-colors outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ServiceImage url={service.imageUrl} alt="" className="aspect-[16/9] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold">{service.name}</h2>
        {service.description && (
          <p className="line-clamp-3 text-muted-foreground">{service.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="text-sm">
            {lowest && (
              <p>
                Từ{' '}
                <span className="text-base font-semibold text-primary">
                  {formatVnd(lowest.unitPrice)}
                </span>
                /{UNIT_LABEL[lowest.unit]}
              </p>
            )}
            {service.minCharge > 0 && (
              <p className="text-muted-foreground">
                Tối thiểu {formatVnd(service.minCharge)}/đơn
              </p>
            )}
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            Xem chi tiết
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </div>
    </Link>
  )
}
