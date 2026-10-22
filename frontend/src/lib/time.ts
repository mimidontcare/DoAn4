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

/** ISO UTC → "02/11/2026 08:00" theo APP_TIMEZONE. */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(APP_TIMEZONE).format('DD/MM/YYYY HH:mm')
}
