import { getApiErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'

export function LoadingState({ text = 'Đang tải...' }: { text?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-8 text-center text-muted-foreground">
      {text}
    </p>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-destructive">{getApiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" className="h-11 cursor-pointer" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  )
}
