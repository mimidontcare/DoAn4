import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Jest globalSetup: áp migration lên database test trước khi chạy e2e.
 * Từ chối chạy nếu DATABASE_URL trong .env.test không trỏ tới database *_test,
 * vì e2e xóa dữ liệu giữa các test.
 */
export default function setupE2e() {
  const env = parseEnv(
    readFileSync(join(__dirname, '..', '.env.test'), 'utf8'),
  );
  assertTestDatabase(env.DATABASE_URL);

  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
    stdio: 'inherit',
  });
}

export function assertTestDatabase(url: string | undefined) {
  const database = url ? new URL(url).pathname.slice(1) : '';
  if (!database.endsWith('_test')) {
    throw new Error(
      `e2e chỉ chạy trên database *_test, DATABASE_URL đang trỏ tới "${database}"`,
    );
  }
}
