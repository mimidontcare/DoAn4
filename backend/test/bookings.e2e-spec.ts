import { INestApplication } from '@nestjs/common';
import { BookingStatus, PricingUnit, UserRole, WardType } from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import request from 'supertest';
import { App } from 'supertest/types';
import type { BookingDetailView } from '../src/bookings/booking.select';
import type { QuoteResult } from '../src/bookings/bookings.service';
import type { Paginated } from '../src/common/dto/pagination.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  dataOf,
  loginAs,
  resetDatabase,
} from './e2e-helpers';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Ho_Chi_Minh';

describe('Booking khách (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let customer: Record<string, string>;
  let customerId: number;
  let serviceId: number;
  let floorItemId: number;
  let addressId: number;
  let wardId: number;
  let zoneId: number;
  let staffIds: number[];

  // Hai ngày tới: luôn nằm trong cửa sổ đặt trước, không phụ thuộc giờ chạy test.
  const date = dayjs().tz(TZ).add(2, 'day').format('YYYY-MM-DD');
  const nextDate = dayjs().tz(TZ).add(3, 'day').format('YYYY-MM-DD');
  const startOn = (day: string, time: string) =>
    dayjs.tz(`${day} ${time}`, TZ).toISOString();
  const startAt = startOn(date, '09:00');

  // 100 m² × 15.000đ, 2 phút/m²: 200 phút công → 1 người, 210 phút.
  const items = () => [{ serviceItemId: floorItemId, quantity: 100 }];
  const quoteBody = () => ({ serviceId, addressId, items: items(), date });
  const createBody = (override: object = {}) => ({
    serviceId,
    addressId,
    items: items(),
    startAt,
    expectedTotal: 1_500_000,
    ...override,
  });

  async function addStaff(index: number) {
    const staff = await prisma.user.create({
      data: {
        email: `staff${index}@example.com`,
        phone: `09111111${String(index).padStart(2, '0')}`,
        fullName: `Nhân viên ${index}`,
        passwordHash: 'x',
        role: UserRole.STAFF,
        staffZones: { create: { zoneId } },
      },
    });
    return staff.id;
  }

  async function createBooking(override: object = {}) {
    const res = await request(server)
      .post('/api/v1/bookings')
      .set(customer)
      .send(createBody(override))
      .expect(201);
    return dataOf<BookingDetailView>(res);
  }

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    customer = bearer(await loginAs(prisma, server, UserRole.CUSTOMER));
    customerId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'customer@example.com' },
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
          detail: 'Số 12 ngõ 34',
          contactName: 'Nguyễn Văn A',
          contactPhone: '0912345678',
          isDefault: true,
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
            name: 'Sàn nhà',
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
    staffIds = [await addStaff(1), await addStaff(2)];
  });

  afterAll(async () => {
    await app.close();
  });

  describe('phân quyền', () => {
    it('không token → 401; STAFF và ADMIN → 403', async () => {
      await request(server).post('/api/v1/bookings/quote').expect(401);
      await request(server).get('/api/v1/me/bookings').expect(401);
      for (const role of [UserRole.ADMIN, UserRole.STAFF]) {
        const token = await loginAs(prisma, server, role);
        await request(server)
          .get('/api/v1/me/bookings')
          .set(bearer(token))
          .expect(403);
      }
    });

    it('IDOR: khách khác không xem, không hủy được đơn; đơn không có → 404', async () => {
      const booking = await createBooking();
      const other = bearer(
        await loginAs(prisma, server, UserRole.CUSTOMER, {
          email: 'other@example.com',
          phone: '0922222222',
        }),
      );
      await request(server)
        .get(`/api/v1/bookings/${booking.id}`)
        .set(other)
        .expect(403);
      await request(server)
        .patch(`/api/v1/bookings/${booking.id}/cancel`)
        .set(other)
        .send({})
        .expect(403);
      await request(server)
        .get('/api/v1/bookings/999999')
        .set(other)
        .expect(404);

      const list = await request(server)
        .get('/api/v1/me/bookings')
        .set(other)
        .expect(200);
      expect(dataOf<Paginated<unknown>>(list).total).toBe(0);
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
      ).toMatchObject({ status: BookingStatus.PENDING });
    });

    it('IDOR: không dùng được địa chỉ của khách khác', async () => {
      const other = bearer(
        await loginAs(prisma, server, UserRole.CUSTOMER, {
          email: 'other@example.com',
          phone: '0922222222',
        }),
      );
      await request(server)
        .post('/api/v1/bookings/quote')
        .set(other)
        .send(quoteBody())
        .expect(404);
    });
  });

  describe('báo giá', () => {
    it('trả giá, số người, thời lượng và giờ còn đủ người', async () => {
      const res = await request(server)
        .post('/api/v1/bookings/quote')
        .set(customer)
        .send(quoteBody())
        .expect(200);
      const quote = dataOf<QuoteResult>(res);
      expect(quote).toMatchObject({
        total: 1_500_000,
        manMinutes: 200,
        staffCount: 1,
        durationMinutes: 210,
      });
      expect(quote.availableStartTimes).toContain(startOn(date, '07:00'));
      // 16:30 + 210 phút = 20:00 là giờ cuối.
      expect(quote.availableStartTimes.at(-1)).toBe(startOn(date, '16:30'));
    });

    it('không đủ nhân viên trong khu vực → không hiện giờ', async () => {
      await prisma.staffZone.deleteMany();
      const res = await request(server)
        .post('/api/v1/bookings/quote')
        .set(customer)
        .send(quoteBody())
        .expect(200);
      expect(dataOf<QuoteResult>(res).availableStartTimes).toEqual([]);
    });

    it('phường vừa bị tắt → 422', async () => {
      await prisma.ward.update({
        where: { id: wardId },
        data: { isActive: false },
      });
      await request(server)
        .post('/api/v1/bookings/quote')
        .set(customer)
        .send(quoteBody())
        .expect(422);
    });

    it('đơn vượt MAX_STAFF → 422; dữ liệu sai → 400', async () => {
      await request(server)
        .post('/api/v1/bookings/quote')
        .set(customer)
        .send({
          ...quoteBody(),
          items: [{ serviceItemId: floorItemId, quantity: 2000 }],
        })
        .expect(422);
      await request(server)
        .post('/api/v1/bookings/quote')
        .set(customer)
        .send({ ...quoteBody(), date: '02/11/2026' })
        .expect(400);
      await request(server)
        .post('/api/v1/bookings/quote')
        .set(customer)
        .send({ ...quoteBody(), items: [...items(), ...items()] })
        .expect(400);
    });
  });

  describe('tạo đơn', () => {
    it('PENDING, snapshot đúng, ghi lịch sử', async () => {
      const booking = await createBooking({ note: 'Gọi trước khi đến' });
      expect(booking).toMatchObject({
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        serviceName: 'Tổng vệ sinh',
        addressText: 'Số 12 ngõ 34, Phường Một, Tỉnh A',
        contactPhone: '0912345678',
        totalPrice: 1_500_000,
        staffCount: 1,
        durationMinutes: 210,
        note: 'Gọi trước khi đến',
      });
      expect(booking.code).toMatch(/^BK\d{6}[A-Z2-9]{4}$/);
      expect(booking.items[0]).toMatchObject({
        nameSnapshot: 'Sàn nhà',
        unitPrice: 15_000,
        quantity: 100,
        amount: 1_500_000,
      });
      expect(booking.histories).toHaveLength(1);
      expect(booking.histories[0]).toMatchObject({
        fromStatus: null,
        toStatus: 'PENDING',
        action: 'CREATE',
      });
    });

    it('P02: đổi bảng giá và địa chỉ không ảnh hưởng đơn cũ', async () => {
      const booking = await createBooking();
      await prisma.serviceItem.update({
        where: { id: floorItemId },
        data: { unitPrice: 99_000, name: 'Tên mới' },
      });
      await prisma.address.update({
        where: { id: addressId },
        data: { detail: 'Địa chỉ mới', isDeleted: true },
      });
      const res = await request(server)
        .get(`/api/v1/bookings/${booking.id}`)
        .set(customer)
        .expect(200);
      expect(dataOf<BookingDetailView>(res)).toMatchObject({
        totalPrice: 1_500_000,
        addressText: 'Số 12 ngõ 34, Phường Một, Tỉnh A',
        items: [{ nameSnapshot: 'Sàn nhà', unitPrice: 15_000 }],
      });
    });

    it('P01: trường giá lạ bị từ chối; giá đổi sau báo giá → 409', async () => {
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(createBody({ totalPrice: 1 }))
        .expect(400);
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(createBody({ expectedTotal: 1 }))
        .expect(409);
      expect(await prisma.booking.count()).toBe(0);
    });

    it('T01: giờ không hợp lệ → 422; startAt thiếu múi giờ → 400', async () => {
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(createBody({ startAt: startOn(date, '09:15') }))
        .expect(422);
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(createBody({ startAt: startOn(date, '17:00') }))
        .expect(422);
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(createBody({ startAt: `${date}T09:00:00` }))
        .expect(400);
    });

    it('bấm đặt 2 lần đồng thời → chỉ 1 đơn', async () => {
      const send = () =>
        request(server)
          .post('/api/v1/bookings')
          .set(customer)
          .send(createBody());
      const results = await Promise.all([send(), send()]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await prisma.booking.count()).toBe(1);
    });

    it('T05: hết người rảnh → 409 và giờ đó không còn hiện', async () => {
      await prisma.staffZone.deleteMany({ where: { staffId: staffIds[1] } });
      await createBooking();
      const other = bearer(
        await loginAs(prisma, server, UserRole.CUSTOMER, {
          email: 'other@example.com',
          phone: '0922222222',
        }),
      );
      const otherId = (
        await prisma.user.findUniqueOrThrow({
          where: { email: 'other@example.com' },
        })
      ).id;
      const otherAddress = await prisma.address.create({
        data: {
          userId: otherId,
          wardId,
          detail: 'Số 5',
          contactName: 'B',
          contactPhone: '0922222222',
        },
      });
      await request(server)
        .post('/api/v1/bookings')
        .set(other)
        .send(createBody({ addressId: otherAddress.id }))
        .expect(409);
      const res = await request(server)
        .post('/api/v1/bookings/quote')
        .set(other)
        .send({ ...quoteBody(), addressId: otherAddress.id })
        .expect(200);
      expect(dataOf<QuoteResult>(res).availableStartTimes).not.toContain(
        startAt,
      );
    });

    it('C07: tối đa 3 đơn PENDING; hủy một đơn thì đặt tiếp được', async () => {
      const staff3 = await addStaff(3);
      expect(staff3).toBeGreaterThan(0);
      const first = await createBooking();
      await createBooking({ startAt: startOn(date, '13:00') });
      await createBooking({ startAt: startOn(nextDate, '09:00') });
      const body = createBody({ startAt: startOn(nextDate, '14:00') });
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(body)
        .expect(422);
      await request(server)
        .patch(`/api/v1/bookings/${first.id}/cancel`)
        .set(customer)
        .send({})
        .expect(200);
      await request(server)
        .post('/api/v1/bookings')
        .set(customer)
        .send(body)
        .expect(201);
    });
  });

  describe('danh sách', () => {
    it('lọc theo trạng thái, phân trang', async () => {
      const booking = await createBooking();
      await request(server)
        .patch(`/api/v1/bookings/${booking.id}/cancel`)
        .set(customer)
        .send({})
        .expect(200);
      await createBooking({ startAt: startOn(date, '13:30') });

      const all = await request(server)
        .get('/api/v1/me/bookings')
        .set(customer)
        .expect(200);
      expect(dataOf<Paginated<BookingDetailView>>(all).total).toBe(2);

      const cancelled = await request(server)
        .get('/api/v1/me/bookings?status=CANCELLED')
        .set(customer)
        .expect(200);
      const page = dataOf<Paginated<BookingDetailView>>(cancelled);
      expect(page.items.map((b) => b.id)).toEqual([booking.id]);

      await request(server)
        .get('/api/v1/me/bookings?status=SAI')
        .set(customer)
        .expect(400);
    });
  });

  describe('hủy', () => {
    const lateCount = async () =>
      (await prisma.user.findUniqueOrThrow({ where: { id: customerId } }))
        .lateCancelCount;

    async function confirmedBooking(hoursFromNow: number) {
      const booking = await createBooking();
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          startAt: dayjs().add(hoursFromNow, 'hour').toDate(),
        },
      });
      return booking;
    }

    const cancel = (id: number) =>
      request(server)
        .patch(`/api/v1/bookings/${id}/cancel`)
        .set(customer)
        .send({ note: 'Đổi kế hoạch' });

    it('PENDING: hủy tự do, ghi lý do và lịch sử', async () => {
      const booking = await createBooking();
      const res = await cancel(booking.id).expect(200);
      expect(dataOf<BookingDetailView>(res)).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'CUSTOMER_REQUEST',
        cancelNote: 'Đổi kế hoạch',
      });
      expect(dataOf<BookingDetailView>(res).histories.at(-1)).toMatchObject({
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        action: 'CANCEL',
      });
      expect(await lateCount()).toBe(0);
    });

    it('CONFIRMED còn nhiều hơn 12 giờ: không tính hủy muộn', async () => {
      const booking = await confirmedBooking(24);
      await cancel(booking.id).expect(200);
      expect(await lateCount()).toBe(0);
    });

    it('CONFIRMED trong vòng 12 giờ: tăng bộ đếm hủy muộn', async () => {
      const booking = await confirmedBooking(5);
      await cancel(booking.id).expect(200);
      expect(await lateCount()).toBe(1);
    });

    it('CONFIRMED còn dưới 2 giờ → 422', async () => {
      const booking = await confirmedBooking(1);
      await cancel(booking.id).expect(422);
      expect(await lateCount()).toBe(0);
    });

    it('B01: đơn đã hủy không hủy lại được', async () => {
      const booking = await createBooking();
      await cancel(booking.id).expect(200);
      await cancel(booking.id).expect(422);
    });

    it('hủy đồng thời: không hủy và không ghi lịch sử 2 lần', async () => {
      const booking = await createBooking();
      const results = await Promise.all([
        cancel(booking.id),
        cancel(booking.id),
      ]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(
        await prisma.bookingStatusHistory.count({
          where: { bookingId: booking.id, action: 'CANCEL' },
        }),
      ).toBe(1);
    });
  });
});
