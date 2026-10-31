import { INestApplication } from '@nestjs/common';
import {
  BookingStatus,
  PricingUnit,
  UserRole,
  UserStatus,
  WardType,
} from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import request from 'supertest';
import { App } from 'supertest/types';
import type { AvailableStaffView } from '../src/bookings/assignment.service';
import type {
  AdminBookingDetailView,
  AdminBookingSummaryView,
  BookingDetailView,
} from '../src/bookings/booking.select';
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

describe('Phân công nhóm (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let admin: Record<string, string>;
  let customer: Record<string, string>;
  let customerId: number;
  let serviceId: number;
  let floorItemId: number;
  let addressId: number;
  let wardId: number;
  let zoneId: number;
  let otherZoneId: number;
  let staff: number[];
  let codeSeq = 0;

  const date = dayjs().tz(TZ).add(2, 'day').format('YYYY-MM-DD');
  const at = (time: string) => dayjs.tz(`${date} ${time}`, TZ).toDate();

  async function addStaff(zone: number) {
    const index = (await prisma.user.count()) + 1;
    const user = await prisma.user.create({
      data: {
        email: `nv${index}@example.com`,
        phone: `09111${String(index).padStart(5, '0')}`,
        fullName: `Nhân viên ${index}`,
        passwordHash: 'x',
        role: UserRole.STAFF,
        staffZones: { create: { zoneId: zone } },
      },
    });
    return user.id;
  }

  async function makeBooking(
    start = '09:00',
    end = '11:00',
    staffCount = 2,
    status: BookingStatus = BookingStatus.PENDING,
  ) {
    codeSeq += 1;
    const booking = await prisma.booking.create({
      data: {
        code: `BKT${codeSeq}`,
        customerId,
        serviceId,
        wardId,
        zoneId,
        serviceName: 'Tổng vệ sinh',
        addressText: 'Số 12',
        contactName: 'A',
        contactPhone: '0912345678',
        startAt: at(start),
        endAt: at(end),
        manMinutes: 240,
        staffCount,
        durationMinutes: 120,
        itemsTotal: 1_000_000,
        subtotal: 1_000_000,
        totalPrice: 1_000_000,
        status,
      },
    });
    return booking;
  }

  const assignReq = (id: number, body: object) =>
    request(server)
      .put(`/api/v1/admin/bookings/${id}/assignments`)
      .set(admin)
      .send(body);

  const assign = (
    booking: { id: number; version: number },
    staffIds: number[],
    leaderId = staffIds[0],
  ) => assignReq(booking.id, { staffIds, leaderId, version: booking.version });

  async function availableIds(id: number) {
    const res = await request(server)
      .get(`/api/v1/admin/bookings/${id}/available-staff`)
      .set(admin)
      .expect(200);
    return dataOf<AvailableStaffView[]>(res).map((s) => s.id);
  }

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
    const province = await prisma.province.create({
      data: { code: 'T1', name: 'Tỉnh A', isActive: true },
    });
    zoneId = (
      await prisma.serviceZone.create({
        data: { provinceId: province.id, name: 'Trung tâm' },
      })
    ).id;
    otherZoneId = (
      await prisma.serviceZone.create({
        data: { provinceId: province.id, name: 'Ngoại thành' },
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
    serviceId = service.id;
    floorItemId = service.items[0].id;
    staff = [];
    for (let i = 0; i < 4; i += 1) staff.push(await addStaff(zoneId));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('phân quyền', () => {
    it('không token → 401; CUSTOMER và STAFF → 403', async () => {
      const booking = await makeBooking();
      const routes = [
        '/api/v1/admin/bookings',
        `/api/v1/admin/bookings/${booking.id}`,
        `/api/v1/admin/bookings/${booking.id}/available-staff`,
      ];
      const staffToken = bearer(await loginAs(prisma, server, UserRole.STAFF));
      for (const route of routes) {
        await request(server).get(route).expect(401);
        await request(server).get(route).set(customer).expect(403);
        await request(server).get(route).set(staffToken).expect(403);
      }
      await request(server)
        .put(`/api/v1/admin/bookings/${booking.id}/assignments`)
        .set(customer)
        .send({ staffIds: staff.slice(0, 2), leaderId: staff[0], version: 0 })
        .expect(403);
      await request(server)
        .patch(`/api/v1/admin/bookings/${booking.id}/cancel`)
        .set(customer)
        .send({ reason: 'OTHER' })
        .expect(403);
    });
  });

  describe('danh sách và chi tiết', () => {
    it('lọc trạng thái, tìm theo mã, có số người đã giao', async () => {
      const first = await makeBooking();
      await assign(first, staff.slice(0, 2)).expect(200);
      await makeBooking('13:00', '15:00');

      const res = await request(server)
        .get('/api/v1/admin/bookings?status=CONFIRMED')
        .set(admin)
        .expect(200);
      const page = dataOf<Paginated<AdminBookingSummaryView>>(res);
      expect(page.total).toBe(1);
      expect(page.items[0]).toMatchObject({
        id: first.id,
        assignedCount: 2,
        customer: { id: customerId },
      });

      const byCode = await request(server)
        .get(`/api/v1/admin/bookings?q=${first.code}`)
        .set(admin)
        .expect(200);
      expect(dataOf<Paginated<unknown>>(byCode).total).toBe(1);
    });

    it('đơn không tồn tại → 404', async () => {
      await request(server)
        .get('/api/v1/admin/bookings/999999')
        .set(admin)
        .expect(404);
    });
  });

  describe('gợi ý nhân viên', () => {
    it('loại người khóa, sai khu vực, đang nghỉ, trùng lịch tính buffer', async () => {
      const outside = await addStaff(otherZoneId);
      await prisma.user.update({
        where: { id: staff[0] },
        data: { status: UserStatus.LOCKED },
      });
      const adminUser = await prisma.user.findFirstOrThrow({
        where: { role: UserRole.ADMIN },
      });
      await prisma.staffUnavailability.create({
        data: {
          staffId: staff[1],
          startAt: at('10:00'),
          endAt: at('10:30'),
          createdBy: adminUser.id,
        },
      });
      const near = await makeBooking('11:15', '12:00', 1);
      await assign(near, [staff[2]]).expect(200);

      const booking = await makeBooking();
      const ids = await availableIds(booking.id);
      expect(ids).toEqual([staff[3]]);
      expect(ids).not.toContain(outside);
    });

    it('đơn CONFIRMED: nhóm hiện tại vẫn được gợi ý và đánh dấu', async () => {
      const booking = await makeBooking();
      await assign(booking, staff.slice(0, 2)).expect(200);
      const res = await request(server)
        .get(`/api/v1/admin/bookings/${booking.id}/available-staff`)
        .set(admin)
        .expect(200);
      const members = dataOf<AvailableStaffView[]>(res).filter(
        (s) => s.isCurrentMember,
      );
      expect(members.map((s) => s.id).sort()).toEqual(staff.slice(0, 2).sort());
    });
  });

  describe('phân công', () => {
    it('PENDING → CONFIRMED, lịch sử, khách thấy nhóm nhưng không thấy SĐT', async () => {
      const booking = await makeBooking();
      const res = await assign(booking, staff.slice(0, 2), staff[1]).expect(
        200,
      );
      const detail = dataOf<AdminBookingDetailView>(res);
      expect(detail).toMatchObject({ status: 'CONFIRMED', version: 1 });
      expect(detail.team[0]).toMatchObject({ id: staff[1], isLeader: true });
      expect(detail.team).toHaveLength(2);
      expect(detail.histories.at(-1)).toMatchObject({
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
        action: 'ASSIGN',
      });

      const seen = await request(server)
        .get(`/api/v1/bookings/${booking.id}`)
        .set(customer)
        .expect(200);
      const view = dataOf<BookingDetailView>(seen);
      expect(view.team[0].isLeader).toBe(true);
      expect(JSON.stringify(view.team)).not.toMatch(/phone|email/);
    });

    it('sai số người, trưởng nhóm ngoài nhóm, người sai khu vực → 422', async () => {
      const outside = await addStaff(otherZoneId);
      const booking = await makeBooking();
      await assign(booking, staff.slice(0, 3)).expect(422);
      await assign(booking, staff.slice(0, 2), staff[3]).expect(422);
      await assign(booking, [staff[0], outside]).expect(422);
      await assign(booking, [staff[0], customerId]).expect(422);
    });

    it('dữ liệu sai → 400', async () => {
      const booking = await makeBooking();
      await assign(booking, [staff[0], staff[0]]).expect(400);
      await assignReq(booking.id, {
        staffIds: staff.slice(0, 2),
        leaderId: staff[0],
      }).expect(400);
    });

    it('nhân viên bị khóa → 422; đang nghỉ → 409', async () => {
      const booking = await makeBooking();
      await prisma.user.update({
        where: { id: staff[0] },
        data: { status: UserStatus.LOCKED },
      });
      await assign(booking, staff.slice(0, 2)).expect(422);
      const adminUser = await prisma.user.findFirstOrThrow({
        where: { role: UserRole.ADMIN },
      });
      await prisma.staffUnavailability.create({
        data: {
          staffId: staff[2],
          startAt: at('08:00'),
          endAt: at('09:30'),
          createdBy: adminUser.id,
        },
      });
      await assign(booking, [staff[2], staff[3]]).expect(409);
    });

    it('T03: cách dưới 30 phút → 409; đúng 30 phút → được', async () => {
      const first = await makeBooking('09:00', '11:00', 1);
      await assign(first, [staff[0]]).expect(200);
      const tooClose = await makeBooking('11:00', '12:00', 1);
      await assign(tooClose, [staff[0]]).expect(409);
      const justRight = await makeBooking('11:30', '12:30', 1);
      await assign(justRight, [staff[0]]).expect(200);
    });

    it('đơn đã hủy không còn giữ lịch của nhân viên', async () => {
      const first = await makeBooking('09:00', '11:00', 1);
      await assign(first, [staff[0]]).expect(200);
      await request(server)
        .patch(`/api/v1/admin/bookings/${first.id}/cancel`)
        .set(admin)
        .send({ reason: 'ADMIN_DECISION' })
        .expect(200);
      const second = await makeBooking('09:00', '11:00', 1);
      await assign(second, [staff[0]]).expect(200);
    });

    it('thay nhóm khi CONFIRMED: giữ trạng thái, ghi lịch sử; không tự trùng với mình', async () => {
      const booking = await makeBooking();
      await assign(booking, staff.slice(0, 2)).expect(200);
      const res = await assign({ id: booking.id, version: 1 }, [
        staff[1],
        staff[2],
      ]).expect(200);
      const detail = dataOf<AdminBookingDetailView>(res);
      expect(detail).toMatchObject({ status: 'CONFIRMED', version: 2 });
      expect(detail.team.map((m) => m.id).sort()).toEqual(
        [staff[1], staff[2]].sort(),
      );
      expect(detail.histories.at(-1)).toMatchObject({
        fromStatus: 'CONFIRMED',
        toStatus: 'CONFIRMED',
        action: 'ASSIGN',
      });
    });

    it('version cũ → 409, nhóm giữ nguyên', async () => {
      const booking = await makeBooking();
      await assign(booking, staff.slice(0, 2)).expect(200);
      await assign(booking, staff.slice(2, 4)).expect(409);
      const team = await prisma.bookingAssignment.findMany({
        where: { bookingId: booking.id },
      });
      expect(team.map((m) => m.staffId).sort()).toEqual(
        staff.slice(0, 2).sort(),
      );
    });

    it('đơn đã hủy → 422', async () => {
      const booking = await makeBooking(
        '09:00',
        '11:00',
        2,
        BookingStatus.CANCELLED,
      );
      await assign(booking, staff.slice(0, 2)).expect(422);
    });
  });

  describe('đồng thời (T06)', () => {
    it('hai admin cùng phân công một đơn: chỉ một thành công', async () => {
      const booking = await makeBooking();
      const results = await Promise.all([
        assign(booking, staff.slice(0, 2)),
        assign(booking, staff.slice(2, 4)),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.bookingAssignment.count({
          where: { bookingId: booking.id },
        }),
      ).toBe(2);
      expect(
        await prisma.bookingStatusHistory.count({
          where: { bookingId: booking.id, action: 'ASSIGN' },
        }),
      ).toBe(1);
    });

    it('một nhân viên vào 2 đơn trùng giờ cùng lúc: chỉ một đơn nhận', async () => {
      for (let round = 0; round < 10; round += 1) {
        await prisma.bookingAssignment.deleteMany();
        await prisma.bookingStatusHistory.deleteMany();
        await prisma.booking.deleteMany();
        const a = await makeBooking('09:00', '11:00', 1);
        const b = await makeBooking('10:00', '12:00', 1);
        const results = await Promise.all([
          assign(a, [staff[0]]),
          assign(b, [staff[0]]),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(
          await prisma.bookingAssignment.count({
            where: { staffId: staff[0] },
          }),
        ).toBe(1);
      }
    });

    it('phân công chéo nhiều nhân viên: không deadlock, không trùng lịch', async () => {
      for (let round = 0; round < 15; round += 1) {
        await prisma.bookingAssignment.deleteMany();
        await prisma.bookingStatusHistory.deleteMany();
        await prisma.booking.deleteMany();
        const a = await makeBooking('09:00', '11:00', 3);
        const b = await makeBooking('09:30', '11:30', 3);
        const results = await Promise.all([
          assign(a, [staff[0], staff[1], staff[2]]),
          assign(b, [staff[2], staff[1], staff[0]]),
        ]);
        // 500 ở đây nghĩa là deadlock.
        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      }
    });

    it('phân công chéo không chung lịch: cả hai đều thành công', async () => {
      for (let round = 0; round < 10; round += 1) {
        await prisma.bookingAssignment.deleteMany();
        await prisma.bookingStatusHistory.deleteMany();
        await prisma.booking.deleteMany();
        const a = await makeBooking('07:00', '08:00', 2);
        const b = await makeBooking('15:00', '16:00', 2);
        const results = await Promise.all([
          assign(a, [staff[0], staff[1]]),
          assign(b, [staff[1], staff[0]]),
        ]);
        expect(results.map((r) => r.status)).toEqual([200, 200]);
      }
    });

    it('khóa nhân viên đúng lúc phân công: không để đơn CONFIRMED có người bị khóa', async () => {
      for (let round = 0; round < 10; round += 1) {
        await prisma.bookingAssignment.deleteMany();
        await prisma.bookingStatusHistory.deleteMany();
        await prisma.booking.deleteMany();
        await prisma.user.update({
          where: { id: staff[0] },
          data: { status: UserStatus.ACTIVE },
        });
        const booking = await makeBooking('09:00', '11:00', 1);
        const [assigned, locked] = await Promise.all([
          assign(booking, [staff[0]]),
          request(server)
            .patch(`/api/v1/admin/users/${staff[0]}/lock`)
            .set(admin),
        ]);
        expect(assigned.status + locked.status).toBe(200 + 422);
      }
    });
  });

  describe('báo giá sau phân công (T04)', () => {
    it('giờ của nhân viên duy nhất đã được giao không còn hiện', async () => {
      await prisma.staffZone.deleteMany({
        where: { staffId: { not: staff[0] } },
      });
      const booking = await makeBooking('09:00', '11:00', 1);
      const quote = async () => {
        const res = await request(server)
          .post('/api/v1/bookings/quote')
          .set(customer)
          .send({
            serviceId,
            addressId,
            date,
            items: [{ serviceItemId: floorItemId, quantity: 30 }],
          })
          .expect(200);
        return dataOf<QuoteResult>(res).availableStartTimes.map((t) =>
          new Date(t).toISOString(),
        );
      };
      expect(await quote()).not.toContain(at('09:00').toISOString());
      await assign(booking, [staff[0]]).expect(200);
      const times = await quote();
      expect(times).not.toContain(at('09:00').toISOString());
      expect(times).not.toContain(at('11:00').toISOString());
      expect(times).toContain(at('11:30').toISOString());
    });
  });

  describe('admin hủy', () => {
    it('ghi lý do B04, không tính hủy muộn cho khách', async () => {
      const booking = await makeBooking();
      const res = await request(server)
        .patch(`/api/v1/admin/bookings/${booking.id}/cancel`)
        .set(admin)
        .send({ reason: 'NO_STAFF_AVAILABLE', note: 'Hết người' })
        .expect(200);
      expect(dataOf<AdminBookingDetailView>(res)).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'NO_STAFF_AVAILABLE',
        cancelNote: 'Hết người',
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: customerId },
      });
      expect(user.lateCancelCount).toBe(0);
    });

    it('lý do sai → 400; IN_PROGRESS → 422', async () => {
      const booking = await makeBooking(
        '09:00',
        '11:00',
        2,
        BookingStatus.IN_PROGRESS,
      );
      await request(server)
        .patch(`/api/v1/admin/bookings/${booking.id}/cancel`)
        .set(admin)
        .send({ reason: 'CUSTOMER_NO_SHOW' })
        .expect(400);
      await request(server)
        .patch(`/api/v1/admin/bookings/${booking.id}/cancel`)
        .set(admin)
        .send({ reason: 'OTHER' })
        .expect(422);
    });
  });

  describe('U03, A04', () => {
    it('U03: không khóa nhân viên còn đơn; thay người xong thì khóa được', async () => {
      const booking = await makeBooking('09:00', '11:00', 1);
      await assign(booking, [staff[0]]).expect(200);
      await request(server)
        .patch(`/api/v1/admin/users/${staff[0]}/lock`)
        .set(admin)
        .expect(422);
      await assign({ id: booking.id, version: 1 }, [staff[1]]).expect(200);
      await request(server)
        .patch(`/api/v1/admin/users/${staff[0]}/lock`)
        .set(admin)
        .expect(200);
    });

    it('A04: lịch nghỉ trùng đơn đã giao → 409; không trùng thì được', async () => {
      const booking = await makeBooking('09:00', '11:00', 1);
      await assign(booking, [staff[0]]).expect(200);
      const create = (start: string, end: string) =>
        request(server)
          .post(`/api/v1/admin/staff/${staff[0]}/unavailabilities`)
          .set(admin)
          .send({
            startAt: at(start).toISOString(),
            endAt: at(end).toISOString(),
          });
      await create('10:00', '12:00').expect(409);
      await create('12:00', '14:00').expect(201);
    });
  });
});
