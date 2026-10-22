import { MapPin } from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { useServiceAreas } from '../hooks'
import { WARD_TYPE_LABEL } from '../units'

/** Khu vực đang phục vụ; tên tỉnh lấy từ API, không hardcode. */
export function ServiceAreasSection() {
  const { data, isPending, isError, error, refetch } = useServiceAreas()

  return (
    <section aria-labelledby="areas-heading" className="grid gap-4">
      <h2 id="areas-heading" className="flex items-center gap-2 text-xl font-semibold">
        <MapPin aria-hidden="true" className="size-5 text-primary" />
        Khu vực phục vụ
        {data?.province && (
          <span className="font-normal text-muted-foreground">· {data.province.name}</span>
        )}
      </h2>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && data.zones.length === 0 && (
        <p className="text-muted-foreground">Hiện chưa có khu vực nào nhận đặt lịch.</p>
      )}
      {data && data.zones.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.zones.map((zone) => (
            <div key={zone.id} className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold">{zone.name}</h3>
              <p className="mt-2 text-muted-foreground">
                {zone.wards
                  .map((w) => `${WARD_TYPE_LABEL[w.type]} ${w.name}`)
                  .join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
