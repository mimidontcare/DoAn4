import { AxiosError } from 'axios'
import { ImageUp, Trash2 } from 'lucide-react'
import { useId, useRef } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ServiceImage } from '@/features/catalog/components/ServiceImage'
import { useUploadImage } from '../hooks'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** Chọn ảnh → upload ngay → gán url trả về vào form. Máy chủ kiểm tra định dạng và dung lượng. */
export function ImageUploadField({
  value,
  onChange,
}: {
  value: string
  onChange: (url: string) => void
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadImage()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { url } = await upload.mutateAsync(file)
      onChange(url)
    } catch (error) {
      const tooLarge = error instanceof AxiosError && error.response?.status === 413
      toast.error(tooLarge ? 'Ảnh vượt quá dung lượng cho phép' : getApiErrorMessage(error))
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Ảnh dịch vụ</Label>
      <div className="flex flex-wrap items-center gap-4">
        <ServiceImage
          url={value || null}
          alt="Ảnh dịch vụ hiện tại"
          className="aspect-[16/9] w-40 rounded-md border"
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUp aria-hidden="true" />
            {upload.isPending ? 'Đang tải ảnh...' : value ? 'Đổi ảnh' : 'Chọn ảnh'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 cursor-pointer"
              onClick={() => onChange('')}
            >
              <Trash2 aria-hidden="true" />
              Bỏ ảnh
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">JPEG, PNG hoặc WebP, tối đa 2MB.</p>
    </div>
  )
}
