import { validateEnv } from './env.validation';

const VALID = {
  DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  APP_TIMEZONE: 'Asia/Ho_Chi_Minh',
};

describe('validateEnv', () => {
  it('áp dụng giá trị mặc định cho biến không bắt buộc', () => {
    const env = validateEnv(VALID);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.THROTTLE_LIMIT).toBe(100);
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
});
