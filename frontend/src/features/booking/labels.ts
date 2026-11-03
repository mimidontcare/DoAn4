import type {
  BookingAction,
  BookingStatus,
  CancelReason,
  PaymentMethod,
  PaymentStatus,
} from './types'

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Chờ phân công',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
}

export const ACTION_LABEL: Record<BookingAction, string> = {
  CREATE: 'Đặt lịch',
  ASSIGN: 'Phân công nhân viên',
  DECLINE: 'Nhân viên từ chối',
  CHECK_IN: 'Bắt đầu làm việc',
  ADJUST: 'Điều chỉnh khối lượng',
  COMPLETE: 'Hoàn thành',
  PAYMENT: 'Xác nhận thanh toán',
  CANCEL: 'Hủy đơn',
  RESCHEDULE: 'Đổi lịch',
}

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  CUSTOMER_REQUEST: 'Khách yêu cầu hủy',
  CUSTOMER_NO_SHOW: 'Khách vắng mặt',
  NO_STAFF_AVAILABLE: 'Không có nhân viên',
  ADMIN_DECISION: 'Quyết định của công ty',
  OTHER: 'Lý do khác',
}
