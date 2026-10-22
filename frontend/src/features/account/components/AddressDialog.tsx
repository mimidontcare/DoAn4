import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import { useServiceAreas } from '@/features/catalog/hooks'
import { WARD_TYPE_LABEL } from '@/features/catalog/units'
import { useAuthStore } from '@/stores/auth.store'
import { useSaveAddress } from '../hooks'
import { addressSchema, type AddressValues } from '../schema'
import type { Address } from '../types'

interface AddressDialogProps {
  /** undefined: thêm mới. */
  address?: Address
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Phường chỉ chọn trong danh sách đang phục vụ (/service-areas), nên địa chỉ ngoài vùng
 * không nhập được từ giao diện; backend vẫn chặn lại (Z01).
 */
export function AddressDialog({ address, open, onOpenChange }: AddressDialogProps) {
  const user = useAuthStore((s) => s.user)
  const areas = useServiceAreas()
  const save = useSaveAddress()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    mode: 'onTouched',
  })

  useEffect(() => {
    if (!open) return
    reset(
      address
        ? {
            // Phường đã ngừng phục vụ không có trong danh sách: buộc khách chọn lại.
            wardId: address.isServiceable ? address.ward.id : Number.NaN,
            detail: address.detail,
            label: address.label ?? '',
            contactName: address.contactName,
            contactPhone: address.contactPhone,
            isDefault: address.isDefault,
          }
        : {
            wardId: Number.NaN,
            detail: '',
            label: '',
            contactName: user?.fullName ?? '',
            contactPhone: user?.phone ?? '',
            isDefault: false,
          },
    )
  }, [open, address, user, reset])

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: address?.id,
        input: { ...values, label: values.label || undefined },
      })
      toast.success(address ? 'Đã cập nhật địa chỉ' : 'Đã thêm địa chỉ')
      onOpenChange(false)
    } catch (error) {
      showServerError(error, setError, { 'phường/xã': 'wardId' })
    }
  })

  const noAreas = areas.data && areas.data.zones.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{address ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</DialogTitle>
          <DialogDescription>
            {areas.data?.province
              ? `Hiện chỉ phục vụ tại ${areas.data.province.name}, trong các phường/xã dưới đây.`
              : 'Chọn phường/xã trong vùng phục vụ.'}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4">
          <FormField id="address-ward" label="Phường/xã" error={errors.wardId?.message}>
            <NativeSelect
              id="address-ward"
              disabled={areas.isPending || noAreas}
              aria-invalid={!!errors.wardId}
              aria-describedby={fieldDescribedBy('address-ward', errors.wardId?.message)}
              {...register('wardId', { valueAsNumber: true })}
            >
              <option value="">
                {areas.isPending
                  ? 'Đang tải...'
                  : noAreas
                    ? 'Hiện chưa có khu vực phục vụ'
                    : 'Chọn phường/xã'}
              </option>
              {areas.data?.zones.map((zone) => (
                <optgroup key={zone.id} label={zone.name}>
                  {zone.wards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {WARD_TYPE_LABEL[ward.type]} {ward.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="address-detail" label="Số nhà, ngõ, đường" error={errors.detail?.message}>
            <Input
              id="address-detail"
              autoComplete="street-address"
              className="h-11"
              aria-invalid={!!errors.detail}
              aria-describedby={fieldDescribedBy('address-detail', errors.detail?.message)}
              {...register('detail')}
            />
          </FormField>
          <FormField
            id="address-label"
            label="Tên gợi nhớ (không bắt buộc)"
            error={errors.label?.message}
          >
            <Input
              id="address-label"
              className="h-11"
              aria-invalid={!!errors.label}
              aria-describedby={fieldDescribedBy('address-label', errors.label?.message)}
              {...register('label')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="address-contact-name"
              label="Người liên hệ"
              error={errors.contactName?.message}
            >
              <Input
                id="address-contact-name"
                autoComplete="name"
                className="h-11"
                aria-invalid={!!errors.contactName}
                aria-describedby={fieldDescribedBy(
                  'address-contact-name',
                  errors.contactName?.message,
                )}
                {...register('contactName')}
              />
            </FormField>
            <FormField
              id="address-contact-phone"
              label="SĐT liên hệ"
              error={errors.contactPhone?.message}
            >
              <Input
                id="address-contact-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                className="h-11"
                aria-invalid={!!errors.contactPhone}
                aria-describedby={fieldDescribedBy(
                  'address-contact-phone',
                  errors.contactPhone?.message,
                )}
                {...register('contactPhone')}
              />
            </FormField>
          </div>
          {!address && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-5 cursor-pointer accent-primary"
                {...register('isDefault')}
              />
              <span>Đặt làm địa chỉ mặc định</span>
            </label>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              className="h-11 cursor-pointer"
              disabled={isSubmitting || noAreas}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu địa chỉ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
