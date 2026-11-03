import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Múi giờ nghiệp vụ (T07): server lưu UTC, giao diện nhập và hiển thị theo múi này. */
export const APP_TIMEZONE = import.meta.env.VITE_APP_TIMEZONE
if (!APP_TIMEZONE) {
  throw new Error('Thiếu biến môi trường VITE_APP_TIMEZONE')
}

/** Giá trị ô datetime-local ("2026-11-02T08:00") hiểu theo APP_TIMEZONE → ISO UTC. */
export function zonedInputToIso(value: string): string {
  return dayjs.tz(value, APP_TIMEZONE).toISOString()
}

/** Ngày hiện tại theo APP_TIMEZONE, cộng thêm số ngày: "2026-11-02". */
export function dateInZone(addDays = 0): string {
  return dayjs().tz(APP_TIMEZONE).add(addDays, 'day').format('YYYY-MM-DD')
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/** ISO UTC → "Thứ hai, 02/11/2026" theo APP_TIMEZONE. */
export function formatWeekday(iso: string): string {
  const day = dayjs(iso).tz(APP_TIMEZONE)
  return `${WEEKDAYS[day.day()]}, ${day.format('DD/MM/YYYY')}`
}

/** ISO UTC → "02/11/2026" theo APP_TIMEZONE. */
export function formatDate(iso: string): string {
  return dayjs(iso).tz(APP_TIMEZONE).format('DD/MM/YYYY')
}

/** Ngày "2026-11-02" (đã theo APP_TIMEZONE) → "02/11/2026". */
export function formatDay(date: string): string {
  return dayjs(date).format('DD/MM/YYYY')
}

/** ISO UTC → "08:00" theo APP_TIMEZONE. */
export function formatTime(iso: string): string {
  return dayjs(iso).tz(APP_TIMEZONE).format('HH:mm')
}

/** ISO UTC → "02/11/2026 08:00" theo APP_TIMEZONE. */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(APP_TIMEZONE).format('DD/MM/YYYY HH:mm')
}
