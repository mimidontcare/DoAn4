/** id của thông báo lỗi (ưu tiên) hoặc gợi ý mà FormField hiển thị dưới input. */
export function fieldDescribedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
