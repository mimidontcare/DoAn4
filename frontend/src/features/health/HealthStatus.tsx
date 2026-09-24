import { Button } from '@/components/ui/button'
import { useHealth } from './hooks'

// Component tạm để chứng minh FE nói chuyện được với BE trong Phase 0.
export function HealthStatus() {
  const { data, isPending, isError, refetch, isFetching } = useHealth()

  let text: string
  if (isPending) text = 'Đang kiểm tra...'
  else if (isError) text = 'Không kết nối được backend'
  else text = `Backend: ${data.status} · Database: ${data.db}`

  return (
    <div className="flex items-center gap-3">
      <p role="status">{text}</p>
      <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
        Kiểm tra lại
      </Button>
    </div>
  )
}
