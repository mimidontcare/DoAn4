import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { assertTestDatabase } from './setup-e2e';

/**
 * Jest setupFiles: nạp .env.test vào process.env trước mọi import của file test.
 * Bắt buộc vì @prisma/client tự nạp .env (database dev) ngay khi được import,
 * và ConfigModule không ghi đè biến đã có trong process.env.
 */
const env = parseEnv(readFileSync(join(__dirname, '..', '.env.test'), 'utf8'));
Object.assign(process.env, env);
assertTestDatabase(process.env.DATABASE_URL);
