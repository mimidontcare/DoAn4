import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AuthResult } from '../src/auth/auth.service';
import type { Paginated } from '../src/common/dto/pagination.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import type { StaffView, UnavailabilityView } from '../src/staff/staff.select';
import {
  bearer,
  createTestApp,
  dataOf,
  loginAs,
  resetDatabase,
} from './e2e-helpers';

describe('Nhân viên (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let admin: Record<string, string>;
  let zoneIds: number[];

  const staffBody = {
    fullName: 'Trần Thị B',
    email: 'nhanvien@example.com',
    phone: '0987654321',
    password: 'matkhautam1',
  };

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = bearer(await loginAs(prisma, server, UserRole.ADMIN));
    const province = await prisma.province.create({
      data: { code: 'T1', name: 'Tỉnh A', isActive: true },
    });
    zoneIds = await Promise.all(
      ['Khu 1', 'Khu 2', 'Khu 3'].map(
        async (name) =>
          (
            await prisma.serviceZone.create({
              data: { provinceId: province.id, name },
            })
          ).id,
      ),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function createStaff(body: object = staffBody) {
    const res = await request(server)
      .post('/api/v1/admin/staff')
      .set(admin)
      .send(body)
      .expect(201);
    return dataOf<StaffView>(res);
  }

  it('API admin: không token → 401, STAFF và CUSTOMER → 403', async () => {
    await request(server).get('/api/v1/admin/staff').expect(401);
    for (const role of [UserRole.STAFF, UserRole.CUSTOMER]) {
      const token = await loginAs(prisma, server, role);
      await request(server)
        .get('/api/v1/admin/staff')
        .set(bearer(token))
        .expect(403);
    }
  });

  it('tạo nhân viên: bắt đổi mật khẩu khi đăng nhập; email trùng → 409', async () => {
    const staff = await createStaff();
    expect(staff).toMatchObject({
      role: 'STAFF',
      mustChangePassword: true,
      zones: [],
    });
    expect(JSON.stringify(staff)).not.toMatch(/passwordHash|password_hash/);

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: staffBody.email, password: staffBody.password })
      .expect(200);
    const session = dataOf<AuthResult>(login);
    expect(session.user.mustChangePassword).toBe(true);
    // Chưa đổi mật khẩu thì không gọi được route khác (U01).
    await request(server)
      .put('/api/v1/me')
      .set(bearer(session.accessToken))
      .send({ fullName: 'Tên Mới' })
      .expect(403);

    await request(server)
      .post('/api/v1/admin/staff')
      .set(admin)
      .send({ ...staffBody, phone: '0911111111' })
      .expect(409);
  });

  it('gán nhiều khu vực; thay toàn bộ; lọc theo khu vực', async () => {
    const staff = await createStaff();
    const res = await request(server)
      .put(`/api/v1/admin/staff/${staff.id}/zones`)
      .set(admin)
      .send({ zoneIds: [zoneIds[0], zoneIds[1]] })
      .expect(200);
    expect(dataOf<StaffView>(res).zones.map((z) => z.id)).toEqual([
      zoneIds[0],
      zoneIds[1],
    ]);

    const replaced = await request(server)
      .put(`/api/v1/admin/staff/${staff.id}/zones`)
      .set(admin)
      .send({ zoneIds: [zoneIds[2]] })
      .expect(200);
    expect(dataOf<StaffView>(replaced).zones.map((z) => z.id)).toEqual([
      zoneIds[2],
    ]);

    const byZone = async (zoneId: number) =>
      dataOf<Paginated<StaffView>>(
        await request(server)
          .get(`/api/v1/admin/staff?zoneId=${zoneId}`)
          .set(admin)
          .expect(200),
      ).total;
    expect(await byZone(zoneIds[2])).toBe(1);
    expect(await byZone(zoneIds[0])).toBe(0);

    await request(server)
      .put(`/api/v1/admin/staff/${staff.id}/zones`)
      .set(admin)
      .send({ zoneIds: [999999] })
      .expect(422);
    await request(server)
      .put(`/api/v1/admin/staff/${staff.id}/zones`)
      .set(admin)
      .send({ zoneIds: [zoneIds[0], zoneIds[0]] })
      .expect(400);
  });

  it('id của khách hoặc admin không coi là nhân viên → 404', async () => {
    await loginAs(prisma, server, UserRole.CUSTOMER);
    const customer = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.CUSTOMER },
    });
    await request(server)
      .get(`/api/v1/admin/staff/${customer.id}`)
      .set(admin)
      .expect(404);
  });

  it('lịch nghỉ: thêm, chồng giờ → 409, sai thứ tự → 422, thiếu múi giờ → 400, xóa', async () => {
    const staff = await createStaff();
    const base = `/api/v1/admin/staff/${staff.id}/unavailabilities`;
    const created = dataOf<UnavailabilityView>(
      await request(server)
        .post(base)
        .set(admin)
        .send({
          startAt: '2026-11-02T01:00:00Z',
          endAt: '2026-11-02T10:00:00Z',
          reason: 'Nghỉ phép',
        })
        .expect(201),
    );

    await request(server)
      .post(base)
      .set(admin)
      .send({ startAt: '2026-11-02T09:00:00Z', endAt: '2026-11-02T12:00:00Z' })
      .expect(409);
    // Liền kề (kết thúc đúng lúc bắt đầu) thì không tính là chồng.
    await request(server)
      .post(base)
      .set(admin)
      .send({ startAt: '2026-11-02T10:00:00Z', endAt: '2026-11-02T11:00:00Z' })
      .expect(201);
    await request(server)
      .post(base)
      .set(admin)
      .send({ startAt: '2026-11-03T10:00:00Z', endAt: '2026-11-03T09:00:00Z' })
      .expect(422);
    await request(server)
      .post(base)
      .set(admin)
      .send({ startAt: '2026-11-04T10:00:00', endAt: '2026-11-04T11:00:00' })
      .expect(400);

    const list = dataOf<UnavailabilityView[]>(
      await request(server).get(base).set(admin).expect(200),
    );
    expect(list).toHaveLength(2);

    await request(server)
      .delete(`${base}/${created.id}`)
      .set(admin)
      .expect(200);
    await request(server)
      .delete(`${base}/${created.id}`)
      .set(admin)
      .expect(404);
  });

  it('khóa tài khoản: phiên cũ hết hiệu lực ngay; mở khóa; không khóa admin', async () => {
    await createStaff();
    const staff = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.STAFF },
    });
    await prisma.user.update({
      where: { id: staff.id },
      data: { mustChangePassword: false },
    });
    const session = dataOf<AuthResult>(
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: staffBody.email, password: staffBody.password })
        .expect(200),
    );

    const locked = await request(server)
      .patch(`/api/v1/admin/users/${staff.id}/lock`)
      .set(admin)
      .expect(200);
    expect(dataOf<StaffView>(locked).status).toBe('LOCKED');
    await request(server)
      .get('/api/v1/auth/me')
      .set(bearer(session.accessToken))
      .expect(403);
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    await request(server)
      .patch(`/api/v1/admin/users/${staff.id}/unlock`)
      .set(admin)
      .expect(200);
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: staffBody.email, password: staffBody.password })
      .expect(200);

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });
    await request(server)
      .patch(`/api/v1/admin/users/${adminUser.id}/lock`)
      .set(admin)
      .expect(422);
  });
});
