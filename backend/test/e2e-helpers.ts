import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { AuthResult } from '../src/auth/auth.service';
import type { ApiResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabase } from './setup-e2e';

export const PASSWORD = 'matkhau123';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  assertTestDatabase(app.get(ConfigService).get<string>('DATABASE_URL'));
  return { app, prisma: app.get(PrismaService), server: app.getHttpServer() };
}

/** Xóa dữ liệu theo thứ tự khóa ngoại. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.address.deleteMany();
  await prisma.staffUnavailability.deleteMany();
  await prisma.staffZone.deleteMany();
  await prisma.serviceItem.deleteMany();
  await prisma.service.deleteMany();
  await prisma.ward.deleteMany();
  await prisma.serviceZone.deleteMany();
  await prisma.province.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

const ROLE_PHONE: Record<UserRole, string> = {
  ADMIN: '0900000001',
  STAFF: '0900000002',
  CUSTOMER: '0900000003',
};

/**
 * Tạo user (không bắt đổi mật khẩu) rồi đăng nhập, trả access token.
 * Truyền email/phone khi cần nhiều user cùng role trong một test.
 */
export async function loginAs(
  prisma: PrismaService,
  server: App,
  role: UserRole,
  account: { email?: string; phone?: string } = {},
): Promise<string> {
  const email = account.email ?? `${role.toLowerCase()}@example.com`;
  await prisma.user.create({
    data: {
      email,
      phone: account.phone ?? ROLE_PHONE[role],
      fullName: role,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role,
    },
  });
  const res = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return (res.body as ApiResponse<AuthResult>).data!.accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export function dataOf<T>(res: request.Response): T {
  return (res.body as ApiResponse<T>).data as T;
}
