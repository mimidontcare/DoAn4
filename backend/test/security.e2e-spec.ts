import { INestApplication } from '@nestjs/common';
import {
  BookingAction,
  BookingStatus,
  PricingUnit,
  UserRole,
  WardType,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  loginAs,
  resetDatabase,
  upcomingWeekday,
} from './e2e-helpers';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

/** Dòng nào cũng có body, để it.each không truyền callback done vào vị trí body. */
const withBody = (rows: [Method, string, object?][]) =>
  rows.map(([method, path, body]) => [method, path, body ?? {}] as const);

/**
 * Mục 15: quét chống IDOR và phân quyền trên mọi endpoint có :id.
 * Mỗi dòng: người gọi sai (khách khác, nhân viên không được giao, sai role)
 * phải bị chặn trước khi chạm tới dữ liệu.
 */
describe('Bảo mật: quét IDOR và phân quyền (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let owner: Record<string, string>;
  let otherCustomer: Record<string, string>;
  let assignedStaff: Record<string, string>;
  let otherStaff: Record<string, string>;
  let admin: Record<string, string>;
  let bookingId: number;
  let addressId: number;
  let staffId: number;

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
    await resetDatabase(prisma);
    admin = bearer(await loginAs(prisma, server, UserRole.ADMIN));
    owner = bearer(await loginAs(prisma, server, UserRole.CUSTOMER));
    otherCustomer = bearer(
      await loginAs(prisma, server, UserRole.CUSTOMER, {
        email: 'other@example.com',
        phone: '0922222222',
      }),
    );
    assignedStaff = bearer(await loginAs(prisma, server, UserRole.STAFF));
    otherStaff = bearer(
      await loginAs(prisma, server, UserRole.STAFF, {
        email: 'staff2@example.com',
        phone: '0933333333',
      }),
    );
    const customer = await prisma.user.findUniqueOrThrow({
      where: { email: 'customer@example.com' },
    });
    const staff = await prisma.user.findUniqueOrThrow({
      where: { email: 'staff@example.com' },
    });
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });
    staffId = staff.id;
    const province = await prisma.province.create({
      data: { code: 'T1', name: 'Tỉnh A', isActive: true },
    });
    const zone = await prisma.serviceZone.create({
      data: { provinceId: province.id, name: 'Trung tâm' },
    });
    const ward = await prisma.ward.create({
      data: {
        provinceId: province.id,
        zoneId: zone.id,
        code: 'W1',
        name: 'Một',
        type: WardType.PHUONG,
        isActive: true,
      },
    });
    addressId = (
      await prisma.address.create({
        data: {
          userId: customer.id,
          wardId: ward.id,
          detail: 'Số 12',
          contactName: 'A',
          contactPhone: '0912345678',
        },
      })
    ).id;
    const service = await prisma.service.create({
      data: {
        name: 'Tổng vệ sinh',
        slug: 'tong-ve-sinh',
        items: {
          create: {
            name: 'Sàn',
            unit: PricingUnit.M2,
            unitPrice: 15_000,
            minutesPerUnit: 2,
            maxQty: 2000,
          },
        },
      },
      include: { items: true },
    });
    const startAt = new Date(`${upcomingWeekday(2)}T02:00:00.000Z`);
    bookingId = (
      await prisma.booking.create({
        data: {
          code: 'BKSEC1',
          customerId: customer.id,
          serviceId: service.id,
          wardId: ward.id,
          zoneId: zone.id,
          serviceName: 'Tổng vệ sinh',
          addressText: 'Số 12',
          contactName: 'A',
          contactPhone: '0912345678',
          startAt,
          endAt: new Date(startAt.getTime() + 2 * 3_600_000),
          manMinutes: 200,
          originalManMinutes: 200,
          staffCount: 1,
          durationMinutes: 120,
          minCharge: 0,
          itemsTotal: 1_000_000,
          subtotal: 1_000_000,
          totalPrice: 1_000_000,
          status: BookingStatus.CONFIRMED,
          assignments: {
            create: { staffId, isLeader: true, assignedBy: adminUser.id },
          },
          histories: {
            create: {
              toStatus: BookingStatus.CONFIRMED,
              action: BookingAction.ASSIGN,
            },
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (
    method: Method,
    path: string,
    token: Record<string, string> | null,
    body: object = {},
  ) => {
    const req = request(server)[method](`/api/v1${path}`);
    if (token) void req.set(token);
    return method === 'get' ? req : req.send(body);
  };

  // Đơn của khách khác → 403 (master plan mục 6 CLAUDE.md: không phải chủ sở hữu).
  const customerRoutes: [Method, string, object?][] = [
    ['get', '/bookings/:id'],
    ['patch', '/bookings/:id/cancel'],
    ['patch', '/bookings/:id/adjustment', { accept: true }],
    ['get', '/bookings/:id/reschedule-options?date=2030-01-02'],
    [
      'patch',
      '/bookings/:id/reschedule',
      { startAt: '2030-01-02T02:00:00Z', expectedTotal: 1 },
    ],
    ['post', '/bookings/:id/review', { rating: 5 }],
  ];

  it.each(withBody(customerRoutes))(
    'khách khác: %s %s → 403',
    async (method, path, body) => {
      await call(
        method,
        path.replace(':id', String(bookingId)),
        otherCustomer,
        body,
      ).expect(403);
    },
  );

  // Nhân viên không được giao đơn → 403 (S01, mục 15).
  const staffRoutes: [Method, string, object?][] = [
    ['get', '/staff/bookings/:id'],
    ['patch', '/staff/bookings/:id/decline', { reason: 'Bận việc' }],
    ['patch', '/staff/bookings/:id/check-in'],
    [
      'post',
      '/staff/bookings/:id/adjustment',
      { items: [{ serviceItemId: 1, proposedQuantity: 1 }] },
    ],
    ['patch', '/staff/bookings/:id/complete'],
    ['patch', '/staff/bookings/:id/confirm-payment', { method: 'CASH' }],
    ['patch', '/staff/bookings/:id/no-show'],
  ];

  it.each(withBody(staffRoutes))(
    'nhân viên không được giao: %s %s → 403',
    async (method, path, body) => {
      await call(
        method,
        path.replace(':id', String(bookingId)),
        otherStaff,
        body,
      ).expect(403);
    },
  );

  // API admin: khách và nhân viên → 403; không token → 401.
  const adminRoutes: [Method, string, object?][] = [
    ['get', '/admin/bookings/:id'],
    ['get', '/admin/bookings/:id/available-staff'],
    [
      'put',
      '/admin/bookings/:id/assignments',
      { staffIds: [1], leaderId: 1, version: 0 },
    ],
    ['patch', '/admin/bookings/:id/cancel', { reason: 'OTHER' }],
    ['patch', '/admin/bookings/:id/adjustment', { accept: true }],
    ['patch', '/admin/bookings/:id/confirm-payment', { method: 'CASH' }],
    ['get', '/admin/staff/:id'],
    ['patch', '/admin/users/:id/lock'],
    ['get', '/admin/dashboard'],
    ['get', '/admin/reviews'],
    ['get', '/admin/blocked-dates'],
  ];

  it.each(withBody(adminRoutes))(
    'sai role: %s %s → 403, không token → 401',
    async (method, path, body) => {
      const url = path.replace(
        ':id',
        String(
          path.includes('staff/:id') || path.includes('users/:id')
            ? staffId
            : bookingId,
        ),
      );
      for (const token of [owner, assignedStaff]) {
        await call(method, url, token, body).expect(403);
      }
      await call(method, url, null, body).expect(401);
    },
  );

  it('khách không dùng được API nhân viên và ngược lại', async () => {
    await call('get', `/staff/bookings/${bookingId}`, owner).expect(403);
    await call('get', `/bookings/${bookingId}`, assignedStaff).expect(403);
  });

  it('địa chỉ của khách khác coi như không tồn tại → 404', async () => {
    await call('put', `/me/addresses/${addressId}`, otherCustomer, {
      detail: 'Số 99 ngõ 1',
    }).expect(404);
    await call('delete', `/me/addresses/${addressId}`, otherCustomer).expect(
      404,
    );
    await call('post', '/bookings/quote', otherCustomer, {
      serviceId: 1,
      addressId,
      items: [{ serviceItemId: 1, quantity: 30 }],
      date: upcomingWeekday(2),
    }).expect(404);
  });

  it('dữ liệu vẫn nguyên sau khi bị quét', async () => {
    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { assignments: true },
    });
    expect(row.status).toBe(BookingStatus.CONFIRMED);
    expect(row.assignments).toHaveLength(1);
    expect(await prisma.review.count()).toBe(0);
  });

  it('không response nào chứa password_hash', async () => {
    const responses = await Promise.all([
      call('get', '/auth/me', owner),
      call('get', `/bookings/${bookingId}`, owner),
      call('get', `/staff/bookings/${bookingId}`, assignedStaff),
      call('get', `/admin/bookings/${bookingId}`, admin),
      call('get', `/admin/staff/${staffId}`, admin),
      call('get', '/admin/staff', admin),
      call('get', '/admin/bookings', admin),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(
        /passwordHash|password_hash/,
      );
    }
  });

  it('khách chỉ thấy tên nhân viên, không thấy SĐT nhân viên', async () => {
    const res = await call('get', `/bookings/${bookingId}`, owner).expect(200);
    expect(
      JSON.stringify((res.body as { data: { team: unknown } }).data.team),
    ).not.toMatch(/phone|email/);
  });

  it('header bảo mật từ helmet và CORS chỉ mở cho frontend', async () => {
    const res = await request(server)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).not.toBe(
      'https://evil.example.com',
    );
  });
});
