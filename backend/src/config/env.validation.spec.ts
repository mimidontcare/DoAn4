import { validateEnv } from './env.validation';

const VALID = {
  DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  APP_TIMEZONE: 'Asia/Ho_Chi_Minh',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('áp dụng giá trị mặc định cho biến không bắt buộc', () => {
    const env = validateEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.THROTTLE_LIMIT).toBe(100);
    expect(env.JWT_ACCESS_TTL).toBe('30m');
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('ép kiểu số từ chuỗi', () => {
    expect(validateEnv({ ...VALID, PORT: '4000' }).PORT).toBe(4000);
  });

  it('ném lỗi khi thiếu DATABASE_URL', () => {
    const missing: Record<string, unknown> = { ...VALID };
    delete missing.DATABASE_URL;
    expect(() => validateEnv(missing)).toThrow(/DATABASE_URL/);
  });

  it('ném lỗi khi NODE_ENV không hợp lệ', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('ném lỗi khi thiếu JWT_ACCESS_SECRET', () => {
    const missing: Record<string, unknown> = { ...VALID };
    delete missing.JWT_ACCESS_SECRET;
    expect(() => validateEnv(missing)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('ném lỗi khi JWT_ACCESS_SECRET quá ngắn', () => {
    expect(() => validateEnv({ ...VALID, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });
});
