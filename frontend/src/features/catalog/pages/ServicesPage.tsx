import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { ServiceAreasSection } from '../components/ServiceAreasSection'
import { ServiceCard } from '../components/ServiceCard'
import { useServices } from '../hooks'

export function ServicesPage() {
  const { data, isPending, isError, error, refetch } = useServices()

  return (
    <div className="grid gap-10">
      <section className="grid gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Dịch vụ vệ sinh tại nhà</h1>
        <p className="max-w-2xl text-muted-foreground">
          Giá niêm yết công khai theo khối lượng công việc. Hệ thống tự tính số nhân viên và
          thời gian thực hiện.
        </p>
      </section>

      <section aria-label="Danh sách dịch vụ">
        {isPending && <LoadingState />}
        {isError && <ErrorState error={error} onRetry={() => void refetch()} />}
        {data && data.length === 0 && (
          <p className="text-muted-foreground">Hiện chưa có dịch vụ nào.</p>
        )}
        {data && data.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((service) => (
              <li key={service.id} className="flex">
                <ServiceCard service={service} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ServiceAreasSection />
    </div>
  )
}
