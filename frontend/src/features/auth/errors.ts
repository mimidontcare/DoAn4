import { AxiosError } from 'axios'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'

/**
 * Gắn lỗi nghiệp vụ của backend (409, 422) vào đúng field theo nội dung thông báo;
 * không khớp field nào thì hiện toast.
 */
export function showServerError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldsByKeyword: Record<string, Path<T>> = {},
) {
  const message = getApiErrorMessage(error)
  const status = error instanceof AxiosError ? error.response?.status : undefined
  if (status === 409 || status === 422) {
    const field = Object.entries(fieldsByKeyword).find(([keyword]) =>
      message.toLowerCase().includes(keyword.toLowerCase()),
    )?.[1]
    if (field) {
      setError(field, { type: 'server', message }, { shouldFocus: true })
      return
    }
  }
  toast.error(message)
}
