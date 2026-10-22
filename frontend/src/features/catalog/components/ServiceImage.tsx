import { Sparkles } from 'lucide-react'
import { resolveAssetUrl } from '@/api/client'
import { cn } from '@/lib/utils'

/** Ảnh dịch vụ; chưa có ảnh thì hiện khối màu nhạt kèm icon. */
export function ServiceImage({
  url,
  alt,
  className,
}: {
  url: string | null
  alt: string
  className?: string
}) {
  const src = resolveAssetUrl(url)
  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-accent text-primary',
          className,
        )}
      >
        <Sparkles aria-hidden="true" className="size-10" />
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={cn('object-cover', className)} />
}
