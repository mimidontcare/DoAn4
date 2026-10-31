import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import { ErrorState, LoadingState } from '@/components/common/QueryStatus'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAssignTeam, useAvailableStaff } from '../hooks'
import { buildAssignTeamSchema, type AssignTeamValues } from '../schema'
import type { AdminBookingDetail } from '../types'

interface AssignTeamDialogProps {
  booking: AdminBookingDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignTeamDialog({ booking, open, onOpenChange }: AssignTeamDialogProps) {
  const available = useAvailableStaff(booking.id, open)
  const assign = useAssignTeam(booking.id)
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AssignTeamValues>({
    resolver: zodResolver(buildAssignTeamSchema(booking.staffCount)),
    defaultValues: { staffIds: [], leaderId: 0 },
  })
  const staffIds = useWatch({ control, name: 'staffIds' })
  const leaderId = useWatch({ control, name: 'leaderId' })

  // Nhóm hiện tại được chọn sẵn, chỉ giữ những người còn rảnh.
  useEffect(() => {
    if (!open || !available.data) return
    const members = booking.team.filter((m) => available.data.some((s) => s.id === m.id))
    reset({
      staffIds: members.map((m) => m.id),
      leaderId: members.find((m) => m.isLeader)?.id ?? 0,
    })
  }, [open, available.data, booking.team, reset])

  function toggle(id: number) {
    const selected = staffIds.includes(id)
    setValue('staffIds', selected ? staffIds.filter((s) => s !== id) : [...staffIds, id], {
      shouldValidate: true,
    })
    if (selected && leaderId === id) setValue('leaderId', 0)
  }

  function onSubmit(values: AssignTeamValues) {
    assign.mutate(
      { ...values, version: booking.version },
      {
        onSuccess: () => {
          toast.success('Đã phân công nhóm')
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error))
          void available.refetch()
        },
      },
    )
  }

  const staffError = errors.staffIds?.message
  const leaderError = errors.leaderId?.message

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phân công đơn {booking.code}</DialogTitle>
          <DialogDescription>
            Chọn đúng {booking.staffCount} nhân viên và một trưởng nhóm. Danh sách chỉ gồm người rảnh
            trong khu vực {booking.zone.name}.
          </DialogDescription>
        </DialogHeader>
        {available.isPending && <LoadingState />}
        {available.isError && (
          <ErrorState error={available.error} onRetry={() => void available.refetch()} />
        )}
        {available.data && available.data.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">
            Không có nhân viên nào rảnh trong giờ này.
          </p>
        )}
        {available.data && available.data.length > 0 && (
          <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">
                Đã chọn {staffIds.length}/{booking.staffCount}
              </legend>
              <Controller
                control={control}
                name="leaderId"
                render={({ field }) => (
                  <ul className="grid gap-2">
                    {available.data.map((staff) => {
                      const checked = staffIds.includes(staff.id)
                      return (
                        <li
                          key={staff.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                        >
                          <label className="flex min-h-6 cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              className="size-5 accent-primary"
                              checked={checked}
                              onChange={() => toggle(staff.id)}
                            />
                            <span className="grid">
                              <span className="font-medium">{staff.fullName}</span>
                              <span className="text-sm text-muted-foreground">{staff.phone}</span>
                            </span>
                          </label>
                          <label
                            className={`flex items-center gap-2 text-sm ${checked ? 'cursor-pointer' : 'opacity-50'}`}
                          >
                            <input
                              type="radio"
                              name="leader"
                              className="size-4 accent-primary"
                              disabled={!checked}
                              checked={field.value === staff.id}
                              onChange={() => field.onChange(staff.id)}
                            />
                            Trưởng nhóm
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              />
              {staffError && (
                <p role="alert" className="text-sm text-destructive">
                  {staffError}
                </p>
              )}
              {leaderError && (
                <p role="alert" className="text-sm text-destructive">
                  {leaderError}
                </p>
              )}
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="h-11 cursor-pointer"
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </Button>
              <Button type="submit" className="h-11 cursor-pointer" disabled={assign.isPending}>
                {assign.isPending ? 'Đang lưu...' : 'Xác nhận phân công'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
