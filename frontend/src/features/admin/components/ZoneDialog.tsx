import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { useSaveZone } from '../hooks'
import { zoneSchema, type ZoneValues } from '../schema'
import type { Zone } from '../types'

interface ZoneDialogProps {
  provinceId: number
  /** undefined: tạo mới. */
  zone?: Zone
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ZoneDialog({ provinceId, zone, open, onOpenChange }: ZoneDialogProps) {
  const save = useSaveZone()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ZoneValues>({
    resolver: zodResolver(zoneSchema),
    mode: 'onTouched',
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (open) reset({ name: zone?.name ?? '' })
  }, [open, zone, reset])

  const submit = handleSubmit(async ({ name }) => {
    try {
      await save.mutateAsync(zone ? { id: zone.id, name } : { provinceId, name })
      toast.success(zone ? 'Đã đổi tên khu vực' : 'Đã tạo khu vực')
      onOpenChange(false)
    } catch (error) {
      showServerError(error, setError, { 'tên khu vực': 'name' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{zone ? 'Đổi tên khu vực' : 'Thêm khu vực'}</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <FormField id="zone-name" label="Tên khu vực" error={errors.name?.message}>
            <Input
              id="zone-name"
              className="h-11"
              aria-invalid={!!errors.name}
              aria-describedby={fieldDescribedBy('zone-name', errors.name?.message)}
              {...register('name')}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" className="h-11 cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
