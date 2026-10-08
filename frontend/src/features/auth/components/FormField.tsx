import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}

/**
 * Label luôn hiển thị, lỗi nằm ngay dưới field. Input bên trong cần tự gắn
 * aria-invalid và aria-describedby={fieldDescribedBy(id, ...)} (field-a11y.ts).
 */
export function FormField({ id, label, error, hint, children }: FormFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
