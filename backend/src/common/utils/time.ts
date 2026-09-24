import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Thời gian lưu UTC; rule giờ phục vụ và cuối tuần phải quy đổi sang múi giờ
 * nghiệp vụ (cấu hình APP_TIMEZONE) trước khi kiểm tra.
 */
export function toZoned(date: Date | string, tz: string): dayjs.Dayjs {
  return dayjs(date).tz(tz);
}

/** Thứ Bảy hoặc Chủ Nhật theo múi giờ nghiệp vụ. */
export function isWeekendInZone(date: Date | string, tz: string): boolean {
  const day = toZoned(date, tz).day();
  return day === 0 || day === 6;
}
