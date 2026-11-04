import { INestApplication } from '@nestjs/common';
import {
  AdjustmentStatus,
  BookingAction,
  BookingStatus,
  PaymentStatus,
  PricingUnit,
  UserRole,
  WardType,
} from '@prisma/client';
import dayjs from 'dayjs';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AdminBookingSummaryView,
  BookingDetailView,
} from '../src/bookings/booking.select';
import type { QuoteResult } from '../src/bookings/bookings.service';
import type { RescheduleOptions } from '../src/bookings/reschedule.service';
import type { Paginated } from '../src/common/dto/pagination.dto';
import type { DashboardView } from '../src/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ServiceReviews } from '../src/reviews/reviews.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import type { StaffDetailView } from '../src/staff/staff.select';
import {
  bearer,
  createTestApp,
  dataOf,
  loginAs,
  resetDatabase,
  TZ,
  upcomingSaturday,
  upcomingWeekday,
} from './e2e-helpers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('Đánh giá, dashboard, tùy chọn (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let admin: Record<string, string>;
  let customer: Record<string, string>;
  let customerId: number;
  let adminId: number;
  let serviceId: number;
  let floorItemId: number;
  let addressId: number;
  let wardId: number;
  let zoneId: number;
  let staff: number[];
  let codeSeq = 0;

  const date = upcomingWeekday(2);
  const at = (day: string, time: string) =>
    dayjs.tz(`${day} ${time}`, TZ).toISOString();

  // 100 m² × 15.000đ, 2 phút/m² → 1 người, 210 phút, 1.500.000đ ngày thường.
  const items = () => [{ serviceItemId: floorItemId, quantity: 100 }];

  async function createViaApi(startAt: string, expectedTotal = 1_500_000) {
    const res = await request(server)
      .post('/api/v1/bookings')
      .set(customer)
      .send({ serviceId, addressId, items: items(), startAt, expectedTotal })
      .expect(201);
    return dataOf<BookingDetailView>(res);
  }

  async function assign(bookingId: number, staffId: number) {
    const { version } = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    await request(server)
      .put(`/api/v1/admin/bookings/${bookingId}/assignments`)
      .set(admin)
      .send({ staffIds: [staffId], leaderId: staffId, version })
      .expect(200);
  }

  /** Đơn đã hoàn thành, có lịch sử COMPLETE tại thời điểm cho trước; staff[0] làm trưởng nhóm. */
  async function completedBooking(
    completedAt = new Date(),
    extra: object = {},
  ) {
    codeSeq += 1;
    const startAt = new Date(completedAt.getTime() - 4 * HOUR);
    return prisma.booking.create({
      data: {
        code: `BKP${codeSeq}`,
        customerId,
        serviceId,
        wardId,
        zoneId,
        serviceName: 'Tổng vệ sinh',
        addressText: 'Số 12',
        contactName: 'A',
        contactPhone: '0912345678',
        startAt,
        endAt: new Date(startAt.getTime() + 2 * HOUR),
        manMinutes: 200,
        originalManMinutes: 200,
        staffCount: 1,
        durationMinutes: 120,
        minCharge: 0,
        itemsTotal: 1_000_000,
        subtotal: 1_000_000,
        totalPrice: 1_000_000,
        status: BookingStatus.COMPLETED,
        assignments: {
          create: { staffId: staff[0], isLeader: true, assignedBy: adminId },
        },
        histories: {
          create: {
            fromStatus: BookingStatus.IN_PROGRESS,
            toStatus: BookingStatus.COMPLETED,
            action: BookingAction.COMPLETE,
            createdAt: completedAt,
          },
        },
        ...extra,
      },
    });
  }

  const review = (id: number, body: object = { rating: 5, comment: 'Tốt' }) =>
    request(server)
      .post(`/api/v1/bookings/${id}/review`)
      .set(customer)
      .send(body);

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = bearer(await loginAs(prisma, server, UserRole.ADMIN));
    customer = bearer(await loginAs(prisma, server, UserRole.CUSTOMER));
    customerId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'customer@example.com' },
      })
    ).id;
    adminId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'admin@example.com' },
      })
    ).id;
    const province = await prisma.province.create({
      data: { code: 'T1', name: 'Tỉnh A', isActive: true },
    });
    zoneId = (
      await prisma.serviceZone.create({
        data: { provinceId: province.id, name: 'Trung tâm' },
      })
    ).id;
    wardId = (
      await prisma.ward.create({
        data: {
          provinceId: province.id,
          zoneId,
          code: 'W1',
          name: 'Một',
          type: WardType.PHUONG,
          isActive: true,
        },
      })
    ).id;
    addressId = (
      await prisma.address.create({
        data: {
          userId: customerId,
          wardId,
          detail: 'Số 12',
          contactName: 'Nguyễn Văn An',
          contactPhone: '0912345678',
        },
      })
    ).id;
    const service = await prisma.service.create({
      data: {
        name: 'Tổng vệ sinh',
        slug: 'tong-ve-sinh',
        minCharge: 500_000,
        items: {
          create: {
            name: 'Sàn',
            unit: PricingUnit.M2,
            unitPrice: 15_000,
            minutesPerUnit: 2,
            minQty: 10,
            maxQty: 2000,
            isRequired: true,
          },
        },
      },
      include: { items: true },
    });
    serviceId = service.id;
    floorItemId = service.items[0].id;
    await prisma.user.update({
      where: { id: customerId },
      data: { fullName: 'Nguyễn Văn An' },
    });
    staff = [];
    for (const i of [1, 2]) {
      const user = await prisma.user.create({
        data: {
          email: `nv${i}@example.com`,
          phone: `091100000${i}`,
          fullName: `Nhân viên ${i}`,
          passwordHash: 'x',
          role: UserRole.STAFF,
          staffZones: { create: { zoneId } },
        },
      });
      staff.push(user.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('đánh giá (V01–V03)', () => {
    it('khách đánh giá đơn hoàn thành; công khai, ẩn, điểm của nhân viên', async () => {
      const booking = await completedBooking();
      const before = dataOf<BookingDetailView>(
        await request(server)
          .get(`/api/v1/bookings/${booking.id}`)
          .set(customer)
          .expect(200),
      );
      expect(before.review).toBeNull();
      expect(new Date(before.reviewDeadline!).getTime()).toBeGreaterThan(
        Date.now() + 6 * DAY,
      );

      await review(booking.id).expect(201);
      const after = dataOf<BookingDetailView>(
        await request(server)
          .get(`/api/v1/bookings/${booking.id}`)
          .set(customer)
          .expect(200),
      );
      expect(after.review).toMatchObject({ rating: 5, comment: 'Tốt' });
      expect(after.reviewDeadline).toBeNull();

      const publicList = async () =>
        dataOf<ServiceReviews>(
          await request(server)
            .get(`/api/v1/services/${serviceId}/reviews`)
            .expect(200),
        );
      expect(await publicList()).toMatchObject({
        average: 5,
        total: 1,
        items: [{ rating: 5, customerName: 'Nguyễn V. A.' }],
      });
      expect(JSON.stringify(await publicList())).not.toMatch(/Nguyễn Văn An/);

      const staffRating = async () =>
        dataOf<StaffDetailView>(
          await request(server)
            .get(`/api/v1/admin/staff/${staff[0]}`)
            .set(admin)
            .expect(200),
        ).rating;
      expect(await staffRating()).toEqual({ average: 5, count: 1 });

      const { id } = (await prisma.review.findFirstOrThrow()) as { id: number };
      await request(server)
        .patch(`/api/v1/admin/reviews/${id}/hide`)
        .set(admin)
        .expect(200);
      expect(await publicList()).toMatchObject({ average: null, total: 0 });
      expect(await staffRating()).toEqual({ average: null, count: 0 });
      const hidden = await request(server)
        .get('/api/v1/admin/reviews?hidden=true')
        .set(admin)
        .expect(200);
      expect(dataOf<Paginated<unknown>>(hidden).total).toBe(1);
      await request(server)
        .patch(`/api/v1/admin/reviews/${id}/unhide`)
        .set(admin)
        .expect(200);
      expect((await publicList()).total).toBe(1);
    });

    it('đánh giá 2 lần → 409, kể cả gửi đồng thời', async () => {
      const booking = await completedBooking();
      const results = await Promise.all([
        review(booking.id),
        review(booking.id),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      await review(booking.id).expect(409);
    });

    it('chưa hoàn thành, quá 7 ngày → 422; điểm sai → 400', async () => {
      const notDone = await completedBooking(new Date(), {
        status: BookingStatus.IN_PROGRESS,
      });
      await review(notDone.id).expect(422);
      const old = await completedBooking(new Date(Date.now() - 8 * DAY));
      await review(old.id).expect(422);
      const fresh = await completedBooking();
      await review(fresh.id, { rating: 6 }).expect(400);
      await review(fresh.id, { rating: 3, isHidden: true }).expect(400);
    });

    it('phân quyền: 401, STAFF 403, khách khác 403, đơn không có 404', async () => {
      const booking = await completedBooking();
      await request(server)
        .post(`/api/v1/bookings/${booking.id}/review`)
        .send({ rating: 5 })
        .expect(401);
      const staffToken = bearer(await loginAs(prisma, server, UserRole.STAFF));
      await request(server)
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set(staffToken)
        .send({ rating: 5 })
        .expect(403);
      const other = bearer(
        await loginAs(prisma, server, UserRole.CUSTOMER, {
          email: 'other@example.com',
          phone: '0922222222',
        }),
      );
      await request(server)
        .post(`/api/v1/bookings/${booking.id}/review`)
        .set(other)
        .send({ rating: 5 })
        .expect(403);
      await review(999999).expect(404);
      await request(server)
        .get('/api/v1/admin/reviews')
        .set(customer)
        .expect(403);
    });
  });

  describe('dashboard (A08) và bộ lọc admin (A06)', () => {
    it('đơn theo trạng thái, doanh thu tháng, điểm, việc cần xử lý', async () => {
      const now = new Date();
      await completedBooking(now, {
        paymentStatus: PaymentStatus.PAID,
        paidAt: now,
        totalPrice: 2_000_000,
      });
      // Thu tiền tháng trước: không tính vào tháng này.
      await completedBooking(new Date(now.getTime() - 40 * DAY), {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(now.getTime() - 40 * DAY),
      });
      const unpaid = await completedBooking();
      await review(unpaid.id, { rating: 4 }).expect(201);
      const overdue = await completedBooking(now, {
        status: BookingStatus.CONFIRMED,
        startAt: new Date(now.getTime() - HOUR),
        endAt: new Date(now.getTime() + HOUR),
      });
      await completedBooking(now, {
        status: BookingStatus.IN_PROGRESS,
        adjustmentStatus: AdjustmentStatus.PENDING,
      });
      await createViaApi(at(date, '09:00'));

      const res = await request(server)
        .get('/api/v1/admin/dashboard')
        .set(admin)
        .expect(200);
      const view = dataOf<DashboardView>(res);
      expect(view.month).toBe(dayjs().tz(TZ).format('YYYY-MM'));
      expect(view.statusCounts).toEqual({
        PENDING: 1,
        CONFIRMED: 1,
        IN_PROGRESS: 1,
        COMPLETED: 3,
        CANCELLED: 0,
      });
      expect(view.revenue).toEqual({ total: 2_000_000, paidCount: 1 });
      expect(view.rating).toEqual({ average: 4, count: 1 });
      expect(view.attention).toEqual({
        unassigned: 1,
        overdueCheckIn: 1,
        pendingAdjustments: 1,
        unpaid: 1,
      });

      const filtered = dataOf<Paginated<AdminBookingSummaryView>>(
        await request(server)
          .get('/api/v1/admin/bookings?overdueCheckIn=true')
          .set(admin)
          .expect(200),
      );
      expect(filtered.items.map((b) => b.id)).toEqual([overdue.id]);
      const unpaidList = dataOf<Paginated<AdminBookingSummaryView>>(
        await request(server)
          .get('/api/v1/admin/bookings?status=COMPLETED&paymentStatus=UNPAID')
          .set(admin)
          .expect(200),
      );
      expect(unpaidList.items.map((b) => b.id)).toEqual([unpaid.id]);
    });

    it('tháng sai định dạng → 400; khách → 403', async () => {
      await request(server)
        .get('/api/v1/admin/dashboard?month=2026-13')
        .set(admin)
        .expect(400);
      await request(server)
        .get('/api/v1/admin/dashboard')
        .set(customer)
        .expect(403);
    });
  });

  describe('ngày không phục vụ (T08)', () => {
    it('chặn báo giá và tạo đơn; báo số đơn bị ảnh hưởng; bỏ chặn thì đặt lại được', async () => {
      await createViaApi(at(date, '09:00'));
      const created = await request(server)
        .post('/api/v1/admin/blocked-dates')
        .set(admin)
        .send({ date, reason: 'Nghỉ lễ' })
        .expect(201);
      const blocked = dataOf<{ id: number; affectedBookings: number }>(created);
      expect(blocked.affectedBookings).toBe(1);

      const quote = async () =>
        dataOf<QuoteResult>(
          await request(server)
            .post('/api/v1/bookings/quote')
            .set(customer)
            .send({ serviceId, addressId, items: items(), date })
            .expect(200),
        );
      expect(await quote()).toMatchObject({
        availableStartTimes: [],
        blockedDate: { reason: 'Nghỉ lễ' },
      });
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send({
          serviceId,
          addressId,
          items: items(),
          startAt: at(date, '14:00'),
          expectedTotal: 1_500_000,
        })
        .expect(422);

      await request(server)
        .post('/api/v1/admin/blocked-dates')
        .set(admin)
        .send({ date })
        .expect(409);
      await request(server)
        .post('/api/v1/admin/blocked-dates')
        .set(admin)
        .send({ date: '2020-01-01' })
        .expect(422);
      const list = await request(server)
        .get('/api/v1/admin/blocked-dates')
        .set(admin)
        .expect(200);
      expect(dataOf<{ date: string }[]>(list)).toEqual([
        expect.objectContaining({ date, reason: 'Nghỉ lễ' }),
      ]);

      await request(server)
        .delete(`/api/v1/admin/blocked-dates/${blocked.id}`)
        .set(admin)
        .expect(200);
      expect((await quote()).blockedDate).toBeNull();
      await request(server)
        .post('/api/v1/admin/blocked-dates')
        .set(customer)
        .send({ date })
        .expect(403);
    });
  });

  describe('phụ phí cuối tuần (P05)', () => {
    it('thứ Bảy cộng 10%; giá ngày thường gửi lên → 409', async () => {
      const saturday = upcomingSaturday(2);
      const quote = dataOf<QuoteResult>(
        await request(server)
          .post('/api/v1/bookings/quote')
          .set(customer)
          .send({ serviceId, addressId, items: items(), date: saturday })
          .expect(200),
      );
      expect(quote).toMatchObject({
        surchargePercent: 10,
        surcharge: 150_000,
        total: 1_650_000,
      });
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send({
          serviceId,
          addressId,
          items: items(),
          startAt: at(saturday, '09:00'),
          expectedTotal: 1_500_000,
        })
        .expect(409);
      const booking = await createViaApi(at(saturday, '09:00'), 1_650_000);
      expect(booking).toMatchObject({
        surcharge: 150_000,
        surchargePercent: 10,
        totalPrice: 1_650_000,
      });
    });
  });

  describe('đổi lịch (R01)', () => {
    const reschedule = (
      id: number,
      startAt: string,
      expectedTotal = 1_500_000,
    ) =>
      request(server)
        .patch(`/api/v1/bookings/${id}/reschedule`)
        .set(customer)
        .send({ startAt, expectedTotal });

    it('PENDING: đổi giờ, đếm số lần, ghi lịch sử; tối đa 2 lần', async () => {
      const booking = await createViaApi(at(date, '09:00'));
      const options = dataOf<RescheduleOptions>(
        await request(server)
          .get(`/api/v1/bookings/${booking.id}/reschedule-options?date=${date}`)
          .set(customer)
          .expect(200),
      );
      expect(options).toMatchObject({
        total: 1_500_000,
        remainingReschedules: 2,
      });
      expect(options.availableStartTimes).not.toContain(at(date, '09:00'));
      expect(options.availableStartTimes).toContain(at(date, '13:00'));

      const moved = dataOf<BookingDetailView>(
        await reschedule(booking.id, at(date, '13:00')).expect(200),
      );
      expect(moved).toMatchObject({
        status: 'PENDING',
        startAt: at(date, '13:00'),
        rescheduleCount: 1,
      });
      expect(moved.histories.at(-1)).toMatchObject({
        action: 'RESCHEDULE',
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
      });
      await reschedule(booking.id, at(date, '13:00')).expect(422);
      await reschedule(booking.id, at(date, '09:30')).expect(200);
      await reschedule(booking.id, at(date, '10:00')).expect(422);
    });

    it('CONFIRMED, nhóm còn rảnh ở giờ mới → giữ nhóm và trạng thái', async () => {
      const booking = await createViaApi(at(date, '09:00'));
      await assign(booking.id, staff[0]);
      const moved = dataOf<BookingDetailView>(
        await reschedule(booking.id, at(date, '13:00')).expect(200),
      );
      expect(moved.status).toBe('CONFIRMED');
      expect(moved.team).toHaveLength(1);
    });

    it('CONFIRMED, nhóm không rảnh ở giờ mới → gỡ nhóm, về PENDING', async () => {
      const a = await createViaApi(at(date, '07:00'));
      await assign(a.id, staff[0]);
      const b = await createViaApi(at(date, '14:00'));
      await assign(b.id, staff[0]);
      const moved = dataOf<BookingDetailView>(
        await reschedule(a.id, at(date, '14:00')).expect(200),
      );
      expect(moved.status).toBe('PENDING');
      expect(moved.team).toEqual([]);
      expect(moved.histories.at(-1)).toMatchObject({
        action: 'RESCHEDULE',
        fromStatus: 'CONFIRMED',
        toStatus: 'PENDING',
      });
    });

    it('sang thứ Bảy: giá mới có phụ phí, phải xác nhận đúng tổng', async () => {
      const booking = await createViaApi(at(date, '09:00'));
      const saturday = upcomingSaturday(2);
      const options = dataOf<RescheduleOptions>(
        await request(server)
          .get(
            `/api/v1/bookings/${booking.id}/reschedule-options?date=${saturday}`,
          )
          .set(customer)
          .expect(200),
      );
      expect(options.total).toBe(1_650_000);
      await reschedule(booking.id, at(saturday, '09:00')).expect(409);
      const moved = dataOf<BookingDetailView>(
        await reschedule(booking.id, at(saturday, '09:00'), 1_650_000).expect(
          200,
        ),
      );
      expect(moved).toMatchObject({
        totalPrice: 1_650_000,
        surcharge: 150_000,
      });
    });

    it('còn dưới 2 giờ, đơn đã hủy → 422; khách khác → 403', async () => {
      const booking = await createViaApi(at(date, '09:00'));
      const other = bearer(
        await loginAs(prisma, server, UserRole.CUSTOMER, {
          email: 'other@example.com',
          phone: '0922222222',
        }),
      );
      await request(server)
        .patch(`/api/v1/bookings/${booking.id}/reschedule`)
        .set(other)
        .send({ startAt: at(date, '13:00'), expectedTotal: 1_500_000 })
        .expect(403);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { startAt: new Date(Date.now() + HOUR) },
      });
      await reschedule(booking.id, at(date, '13:00')).expect(422);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
      });
      await reschedule(booking.id, at(date, '13:00')).expect(422);
    });
  });

  describe('job tự hủy', () => {
    it('hủy đơn PENDING sát giờ với NO_STAFF_AVAILABLE; không đụng đơn khác', async () => {
      const soon = await completedBooking(new Date(), {
        status: BookingStatus.PENDING,
        startAt: new Date(Date.now() + HOUR),
      });
      const later = await completedBooking(new Date(), {
        status: BookingStatus.PENDING,
        startAt: new Date(Date.now() + 5 * HOUR),
      });
      const confirmed = await completedBooking(new Date(), {
        status: BookingStatus.CONFIRMED,
        startAt: new Date(Date.now() + HOUR),
      });

      const cancelled = await app.get(SchedulerService).autoCancelUnstaffed();
      expect(cancelled).toBe(1);
      const rows = await prisma.booking.findMany({
        where: { id: { in: [soon.id, later.id, confirmed.id] } },
        orderBy: { id: 'asc' },
      });
      expect(rows.map((r) => r.status)).toEqual([
        'CANCELLED',
        'PENDING',
        'CONFIRMED',
      ]);
      expect(rows[0].cancelReason).toBe('NO_STAFF_AVAILABLE');
      const history = await prisma.bookingStatusHistory.findFirstOrThrow({
        where: { bookingId: soon.id, action: 'CANCEL' },
      });
      expect(history.changedBy).toBeNull();
    });
  });
});
