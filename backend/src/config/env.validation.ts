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
