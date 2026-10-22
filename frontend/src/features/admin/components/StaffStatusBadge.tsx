import type { Staff } from '../types'

/** Trạng thái tài khoản; chữ đi kèm màu để không phụ thuộc vào màu sắc. */
export function StaffStatusBadge({ staff }: { staff: Staff }) {
  if (staff.status === 'LOCKED') {
    return (
      <span className="rounded-md border border-destructive px-2 py-1 text-sm font-medium text-destructive">
        Đã khóa
      </span>
    )
  }
  if (staff.mustChangePassword) {
    return (
      <span className="rounded-md bg-secondary px-2 py-1 text-sm font-medium text-secondary-foreground">
        Chưa đổi mật khẩu
      </span>
    )
  }
  return (
    <span className="rounded-md bg-accent px-2 py-1 text-sm font-medium text-accent-foreground">
      Đang hoạt động
    </span>
  )
}
