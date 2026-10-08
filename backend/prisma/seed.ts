/**
 * Seed tài khoản ban đầu: 1 admin và 1 nhân viên mẫu (U01: do hệ thống tạo,
 * bắt đổi mật khẩu lần đầu). Thông tin đọc từ biến SEED_* trong .env, không hardcode.
 * Chạy lại nhiều lần an toàn: tài khoản đã có (theo email) thì giữ nguyên, kể cả mật khẩu.
 *
 *   npx prisma db seed
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface SeedAccount {
  role: UserRole;
  envPrefix: string;
}

const ACCOUNTS: SeedAccount[] = [
  { role: UserRole.ADMIN, envPrefix: 'SEED_ADMIN' },
  { role: UserRole.STAFF, envPrefix: 'SEED_STAFF' },
];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem .env.example)`);
  }
  return value;
}

async function seedAccount({ role, envPrefix }: SeedAccount, rounds: number) {
  const email = requireEnv(`${envPrefix}_EMAIL`).toLowerCase();
  const password = requireEnv(`${envPrefix}_PASSWORD`);
  if (password.length < 8) {
    throw new Error(`${envPrefix}_PASSWORD phải có ít nhất 8 ký tự`);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    console.log(`= ${role} ${email} đã tồn tại, bỏ qua`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      phone: requireEnv(`${envPrefix}_PHONE`),
      fullName: requireEnv(`${envPrefix}_NAME`),
      passwordHash: await bcrypt.hash(password, rounds),
      role,
      mustChangePassword: true,
    },
  });
  console.log(`+ Đã tạo ${role} ${email}`);
}

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
  for (const account of ACCOUNTS) {
    await seedAccount(account, rounds);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
