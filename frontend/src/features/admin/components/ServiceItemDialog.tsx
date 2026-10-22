import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, type Path } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { showServerError } from '@/features/auth/errors'
import { fieldDescribedBy } from '@/features/auth/components/field-a11y'
import { FormField } from '@/features/auth/components/FormField'
import { UNIT_LABEL } from '@/features/catalog/units'
import { useSaveServiceItem } from '../hooks'
import { serviceItemSchema, type ServiceItemValues } from '../schema'
import type { AdminServiceItem } from '../types'

const EMPTY: ServiceItemValues = {
  name: '',
  unit: 'UNIT',
  unitPrice: 0,
  minutesPerUnit: 0,
  minQty: 0,
  maxQty: 1,
  isRequired: false,
  sortOrder: 0,
}

const NUMBER_FIELDS: { name: Path<ServiceItemValues>; label: string; hint?: string }[] = [
  { name: 'unitPrice', label: 'Đơn giá (VND)' },
  { name: 'minutesPerUnit', label: 'Phút công / đơn vị', hint: 'Dùng để tính số nhân viên và thời lượng.' },
  { name: 'minQty', label: 'Số lượng tối thiểu' },
  { name: 'maxQty', label: 'Số lượng tối đa' },
  { name: 'sortOrder', label: 'Thứ tự hiển thị' },
]

interface ServiceItemDialogProps {
  serviceId: number
  /** undefined: thêm mới. */
  item?: AdminServiceItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServiceItemDialog({ serviceId, item, open, onOpenChange }: ServiceItemDialogProps) {
  const save = useSaveServiceItem(serviceId)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceItemValues>({
    resolver: zodResolver(serviceItemSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (open) reset(item ?? EMPTY)
  }, [open, item, reset])

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ itemId: item?.id, input: values })
      toast.success(item ? 'Đã cập nhật hạng mục' : 'Đã thêm hạng mục')
      onOpenChange(false)
    } catch (error) {
      showServerError(error, setError, {
        'tối thiểu không được lớn': 'maxQty',
        'bắt buộc': 'minQty',
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Sửa hạng mục giá' : 'Thêm hạng mục giá'}</DialogTitle>
          <DialogDescription>
            Đổi giá chỉ áp dụng cho đơn đặt sau; đơn cũ giữ giá lúc đặt.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <FormField id="item-name" label="Tên hạng mục" error={errors.name?.message}>
            <Input
              id="item-name"
              className="h-11"
              aria-invalid={!!errors.name}
              aria-describedby={fieldDescribedBy('item-name', errors.name?.message)}
              {...register('name')}
            />
          </FormField>
          <FormField id="item-unit" label="Đơn vị tính">
            <NativeSelect id="item-unit" {...register('unit')}>
              <option value="UNIT">Theo cái/bộ ({UNIT_LABEL.UNIT})</option>
              <option value="M2">Theo diện tích ({UNIT_LABEL.M2})</option>
            </NativeSelect>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map(({ name, label, hint }) => {
              const id = `item-${name}`
              const error = errors[name]?.message
              return (
                <FormField key={name} id={id} label={label} error={error} hint={hint}>
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="h-11"
                    aria-invalid={!!error}
                    aria-describedby={fieldDescribedBy(id, error, hint)}
                    {...register(name, { valueAsNumber: true })}
                  />
                </FormField>
              )
            })}
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className="size-5 cursor-pointer accent-primary" {...register('isRequired')} />
            <span>Bắt buộc (khách phải đặt ít nhất số lượng tối thiểu)</span>
          </label>
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
