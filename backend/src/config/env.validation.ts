import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_ORIGIN: string;

  @IsString()
  @IsNotEmpty()
  APP_TIMEZONE: string;

  @IsInt()
  @Min(1)
  THROTTLE_TTL_MS: number;

  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  // Định dạng của thư viện ms: 30m, 1h, 3600s…
  @Matches(/^\d+[smhd]$/)
  JWT_ACCESS_TTL: string;

  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS: number;

  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_ROUNDS: number;

  @IsInt()
  @Min(1)
  AUTH_THROTTLE_TTL_MS: number;

  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number;

  // C04: số địa chỉ tối đa mỗi khách (chưa tính địa chỉ đã xóa).
  @IsInt()
  @Min(1)
  MAX_ADDRESSES_PER_CUSTOMER: number;

  // T01: giờ phục vụ theo múi giờ nghiệp vụ.
  @IsInt()
  @Min(0)
  SERVICE_OPEN_HOUR: number;

  @IsInt()
  @Min(1)
  SERVICE_CLOSE_HOUR: number;

  // T01: bước giờ bắt đầu, cũng là bội làm tròn thời lượng.
  @IsInt()
  @Min(1)
  BOOKING_SLOT_STEP_MINUTES: number;

  // T02: đặt trước tối thiểu và tối đa.
  @IsInt()
  @Min(0)
  BOOKING_MIN_LEAD_HOURS: number;

  @IsInt()
  @Min(1)
  BOOKING_MAX_ADVANCE_DAYS: number;

  // T03: buffer giữa hai ca của một nhân viên.
  @IsInt()
  @Min(0)
  STAFF_BUFFER_MINUTES: number;

  // Q02: phút công một nhân viên đảm nhận.
  @IsInt()
  @Min(1)
  MAN_MINUTES_PER_STAFF: number;

  // Q03: đặt bằng 1 là phương án an toàn.
  @IsInt()
  @Min(1)
  MAX_STAFF_PER_BOOKING: number;

  // C07: số đơn PENDING tối đa mỗi khách.
  @IsInt()
  @Min(1)
  MAX_PENDING_BOOKINGS_PER_CUSTOMER: number;

  // C01–C03: mốc được hủy và mốc tính hủy muộn.
  @IsInt()
  @Min(0)
  CANCEL_MIN_HOURS_BEFORE_START: number;

  @IsInt()
  @Min(0)
  LATE_CANCEL_HOURS: number;

  // Phần B: check-in từ trước đến sau giờ bắt đầu bao nhiêu phút.
  @IsInt()
  @Min(0)
  CHECKIN_EARLY_MINUTES: number;

  @IsInt()
  @Min(0)
  CHECKIN_LATE_MINUTES: number;

  // S07: báo khách vắng mặt sau giờ bắt đầu bao nhiêu phút.
  @IsInt()
  @Min(0)
  NO_SHOW_AFTER_MINUTES: number;

  // A04: tăng tối đa bao nhiêu % phút công lúc đặt.
  @IsInt()
  @Min(0)
  MAX_ADJUSTMENT_PERCENT: number;

  // S01: khoảng ngày tối đa của một lần xem lịch.
  @IsInt()
  @Min(1)
  STAFF_SCHEDULE_MAX_DAYS: number;

  // P05: % phụ phí đơn bắt đầu vào thứ Bảy, Chủ nhật.
  @IsInt()
  @Min(0)
  WEEKEND_SURCHARGE_PERCENT: number;

  // R01: số lần đổi lịch tối đa mỗi đơn.
  @IsInt()
  @Min(0)
  MAX_RESCHEDULES: number;

  // V01: số ngày được đánh giá kể từ khi đơn hoàn thành.
  @IsInt()
  @Min(1)
  REVIEW_WINDOW_DAYS: number;

  // Job tự hủy: đơn PENDING còn ít hơn số giờ này thì hủy.
  @IsInt()
  @Min(0)
  AUTO_CANCEL_BEFORE_HOURS: number;

  @IsInt()
  @Min(1)
  AUTO_CANCEL_INTERVAL_MINUTES: number;

  // Tắt job định kỳ khi chạy e2e để không đụng dữ liệu test.
  @IsIn(['true', 'false'])
  SCHEDULER_ENABLED: string;

  // Thư mục lưu ảnh upload, tương đối với thư mục chạy backend.
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string;

  @IsInt()
  @Min(1)
  UPLOAD_MAX_BYTES: number;
}

const DEFAULTS: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: '3000',
  THROTTLE_TTL_MS: '60000',
  THROTTLE_LIMIT: '100',
  JWT_ACCESS_TTL: '30m',
  REFRESH_TOKEN_TTL_DAYS: '7',
  BCRYPT_ROUNDS: '10',
  AUTH_THROTTLE_TTL_MS: '60000',
  AUTH_THROTTLE_LIMIT: '5',
  MAX_ADDRESSES_PER_CUSTOMER: '5',
  SERVICE_OPEN_HOUR: '7',
  SERVICE_CLOSE_HOUR: '20',
  BOOKING_SLOT_STEP_MINUTES: '30',
  BOOKING_MIN_LEAD_HOURS: '3',
  BOOKING_MAX_ADVANCE_DAYS: '14',
  STAFF_BUFFER_MINUTES: '30',
  MAN_MINUTES_PER_STAFF: '240',
  MAX_STAFF_PER_BOOKING: '4',
  MAX_PENDING_BOOKINGS_PER_CUSTOMER: '3',
  CANCEL_MIN_HOURS_BEFORE_START: '2',
  LATE_CANCEL_HOURS: '12',
  CHECKIN_EARLY_MINUTES: '30',
  CHECKIN_LATE_MINUTES: '60',
  NO_SHOW_AFTER_MINUTES: '30',
  MAX_ADJUSTMENT_PERCENT: '30',
  STAFF_SCHEDULE_MAX_DAYS: '31',
  WEEKEND_SURCHARGE_PERCENT: '10',
  MAX_RESCHEDULES: '2',
  REVIEW_WINDOW_DAYS: '7',
  AUTO_CANCEL_BEFORE_HOURS: '2',
  AUTO_CANCEL_INTERVAL_MINUTES: '5',
  SCHEDULER_ENABLED: 'true',
  UPLOAD_DIR: 'uploads',
  UPLOAD_MAX_BYTES: '2097152',
};

/**
 * Kiểm tra biến môi trường lúc khởi động; thiếu hoặc sai kiểu thì app không chạy.
 * Secret (JWT_ACCESS_SECRET) và DATABASE_URL, FRONTEND_ORIGIN, APP_TIMEZONE bắt buộc phải khai báo, không có mặc định.
 */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(
    EnvironmentVariables,
    { ...DEFAULTS, ...config },
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Biến môi trường không hợp lệ: ${detail}`);
  }
  return validated;
}
