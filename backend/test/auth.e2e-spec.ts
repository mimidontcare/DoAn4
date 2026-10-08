import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { AuthResult } from '../src/auth/auth.service';
import { Roles } from '../src/common/decorators/roles.decorator';
import type { ApiResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import type { PublicUser } from '../src/users/user.select';
import { assertTestDatabase } from './setup-e2e';

/** Route chỉ có trong test để kiểm tra RolesGuard và chặn must_change_password. */
@Controller('test-probe')
class ProbeController {
  @Get('any')
  any() {
    return 'ok';
  }

  @Roles(UserRole.ADMIN)
  @Get('admin')
  admin() {
    return 'ok';
  }
}

const PASSWORD = 'matkhau123';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    assertTestDatabase(app.get(ConfigService).get<string>('DATABASE_URL'));
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(
    overrides: Partial<{
      email: string;
      phone: string;
      role: UserRole;
      status: UserStatus;
      mustChangePassword: boolean;
    }> = {},
  ) {
    return prisma.user.create({
      data: {
        email: 'user@example.com',
        phone: '0911111111',
        fullName: 'Người Dùng',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        role: UserRole.CUSTOMER,
        ...overrides,
      },
    });
  }

  async function login(email: string, password = PASSWORD) {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return (res.body as ApiResponse<AuthResult>).data!;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('POST /auth/register', () => {
    const body = {
      fullName: 'Nguyễn Văn A',
      email: '  Khach@Example.com ',
      phone: '0912345678',
      password: PASSWORD,
    };

    it('tạo CUSTOMER, trả cặp token, không lộ password_hash', async () => {
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send(body)
        .expect(201);

      const data = (res.body as ApiResponse<AuthResult>).data!;
      expect(data.accessToken).toEqual(expect.any(String));
      expect(data.refreshToken).toEqual(expect.any(String));
      expect(data.user).toMatchObject({
        email: 'khach@example.com',
        role: 'CUSTOMER',
        mustChangePassword: false,
      });
      expect(JSON.stringify(res.body)).not.toMatch(
        /passwordHash|password_hash/,
      );
    });

    it('trùng email → 409', async () => {
      await createUser({ email: 'khach@example.com' });
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send(body)
        .expect(409);
      expect((res.body as ApiResponse<null>).message).toBe(
        'Email đã được sử dụng',
      );
    });

    it('trùng SĐT → 409', async () => {
      await createUser({ phone: body.phone });
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send(body)
        .expect(409);
      expect((res.body as ApiResponse<null>).message).toBe(
        'Số điện thoại đã được sử dụng',
      );
    });

    it('mật khẩu ngắn, SĐT sai, field thừa → 400', async () => {
      await request(server)
        .post('/api/v1/auth/register')
        .send({ ...body, password: '1234567' })
        .expect(400);
      await request(server)
        .post('/api/v1/auth/register')
        .send({ ...body, phone: '12345' })
        .expect(400);
      await request(server)
        .post('/api/v1/auth/register')
        .send({ ...body, role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('sai mật khẩu và email không tồn tại cùng trả 401, cùng thông báo', async () => {
      await createUser();
      const wrongPassword = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'sai-mat-khau' })
        .expect(401);
      const unknownEmail = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'khong-co@example.com', password: PASSWORD })
        .expect(401);
      expect((wrongPassword.body as ApiResponse<null>).message).toBe(
        (unknownEmail.body as ApiResponse<null>).message,
      );
    });

    it('tài khoản bị khóa → 403', async () => {
      await createUser({ status: UserStatus.LOCKED });
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: PASSWORD })
        .expect(403);
    });
  });

  describe('Xác thực và phân quyền', () => {
    it('/auth/me: thiếu token hoặc token sai → 401', async () => {
      await request(server).get('/api/v1/auth/me').expect(401);
      await request(server)
        .get('/api/v1/auth/me')
        .set(bearer('token-sai'))
        .expect(401);
    });

    it('/auth/me trả user hiện tại, không có password_hash', async () => {
      await createUser();
      const { accessToken } = await login('user@example.com');
      const res = await request(server)
        .get('/api/v1/auth/me')
        .set(bearer(accessToken))
        .expect(200);
      expect((res.body as ApiResponse<PublicUser>).data).toMatchObject({
        email: 'user@example.com',
        role: 'CUSTOMER',
      });
      expect(JSON.stringify(res.body)).not.toMatch(
        /passwordHash|password_hash/,
      );
    });

    it('bị khóa sau khi đăng nhập → access token cũ nhận 403 ngay', async () => {
      const user = await createUser();
      const { accessToken } = await login('user@example.com');
      await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.LOCKED },
      });
      await request(server)
        .get('/api/v1/auth/me')
        .set(bearer(accessToken))
        .expect(403);
    });

    it('sai role → 403, đúng role → 200', async () => {
      await createUser();
      await createUser({
        email: 'admin@example.com',
        phone: '0922222222',
        role: UserRole.ADMIN,
      });
      const customer = await login('user@example.com');
      const admin = await login('admin@example.com');

      await request(server)
        .get('/api/v1/test-probe/admin')
        .set(bearer(customer.accessToken))
        .expect(403);
      await request(server)
        .get('/api/v1/test-probe/admin')
        .set(bearer(admin.accessToken))
        .expect(200);
    });
  });

  describe('Bắt đổi mật khẩu lần đầu (U01)', () => {
    it('chặn route khác bằng 403 cho tới khi đổi mật khẩu', async () => {
      await createUser({ role: UserRole.STAFF, mustChangePassword: true });
      const session = await login('user@example.com');
      expect(session.user.mustChangePassword).toBe(true);
      const auth = bearer(session.accessToken);

      await request(server).get('/api/v1/test-probe/any').set(auth).expect(403);
      await request(server)
        .put('/api/v1/me')
        .set(auth)
        .send({ fullName: 'Tên Mới' })
        .expect(403);
      await request(server).get('/api/v1/auth/me').set(auth).expect(200);

      await request(server)
        .put('/api/v1/me/password')
        .set(auth)
        .send({ currentPassword: 'sai-mat-khau', newPassword: 'matkhaumoi1' })
        .expect(422);
      await request(server)
        .put('/api/v1/me/password')
        .set(auth)
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(422);

      const changed = await request(server)
        .put('/api/v1/me/password')
        .set(auth)
        .send({ currentPassword: PASSWORD, newPassword: 'matkhaumoi1' })
        .expect(200);
      const next = (changed.body as ApiResponse<AuthResult>).data!;
      expect(next.user.mustChangePassword).toBe(false);

      await request(server)
        .get('/api/v1/test-probe/any')
        .set(bearer(next.accessToken))
        .expect(200);
      // Phiên cũ bị thu hồi khi đổi mật khẩu.
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      await login('user@example.com', 'matkhaumoi1');
    });
  });

  describe('POST /auth/refresh và /auth/logout', () => {
    it('rotation: token cũ dùng lại → 401, token mới dùng được', async () => {
      await createUser();
      const first = await login('user@example.com');

      const res = await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200);
      const second = (res.body as ApiResponse<AuthResult>).data!;
      expect(second.refreshToken).not.toBe(first.refreshToken);

      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(401);
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(200);
    });

    it('refresh token hết hạn hoặc không tồn tại → 401', async () => {
      await createUser();
      const session = await login('user@example.com');
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'khong-ton-tai' })
        .expect(401);
    });

    it('logout thu hồi token; không thu hồi được token của người khác', async () => {
      await createUser();
      await createUser({ email: 'other@example.com', phone: '0933333333' });
      const mine = await login('user@example.com');
      const other = await login('other@example.com');

      await request(server)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: mine.refreshToken })
        .expect(401);

      // Gửi token của người khác: không có tác dụng.
      await request(server)
        .post('/api/v1/auth/logout')
        .set(bearer(mine.accessToken))
        .send({ refreshToken: other.refreshToken })
        .expect(200);
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: other.refreshToken })
        .expect(200);

      await request(server)
        .post('/api/v1/auth/logout')
        .set(bearer(mine.accessToken))
        .send({ refreshToken: mine.refreshToken })
        .expect(200);
      await request(server)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: mine.refreshToken })
        .expect(401);
    });
  });

  describe('PUT /me', () => {
    it('sửa họ tên và SĐT; SĐT trùng người khác → 409', async () => {
      await createUser();
      await createUser({ email: 'other@example.com', phone: '0933333333' });
      const { accessToken } = await login('user@example.com');

      const res = await request(server)
        .put('/api/v1/me')
        .set(bearer(accessToken))
        .send({ fullName: '  Tên Mới ', phone: '0944444444' })
        .expect(200);
      expect((res.body as ApiResponse<PublicUser>).data).toMatchObject({
        fullName: 'Tên Mới',
        phone: '0944444444',
      });

      await request(server)
        .put('/api/v1/me')
        .set(bearer(accessToken))
        .send({ phone: '0933333333' })
        .expect(409);
      await request(server)
        .put('/api/v1/me')
        .set(bearer(accessToken))
        .send({ email: 'doi@example.com' })
        .expect(400);
    });
  });
});
