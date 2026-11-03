import { INestApplication } from '@nestjs/common';
import { BookingStatus, PricingUnit, UserRole, WardType } from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AdminBookingDetailView,
  BookingDetailView,
  StaffBookingDetailView,
  StaffBookingSummaryView,
} from '../src/bookings/booking.select';
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
const MINUTE = 60_000;

describe('Nhân viên thực hiện (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let admin: Record<string, string>;
  let customer: Record<string, string>;
  let leader: Record<string, string>;
  let member: Record<string, string>;
  let outsider: Record<string, string>;
  let customerId: number;
  let leaderId: number;
  let memberId: number;
  let serviceId: number;
  let floorId: number;
  let sofaId: number;
  let curtainId: number;
  let wardId: number;
  let zoneId: number;
  let codeSeq = 0;

  async function staffAccount(email: string, phone: string) {
    const token = bearer(
      await loginAs(prisma, server, UserRole.STAFF, { email, phone }),
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.staffZone.create({ data: { staffId: user.id, zoneId } });
    return { token, id: user.id };
  }

  /**
   * Đơn CONFIRMED do admin phân công (leader là trưởng nhóm): 100 m² sàn,
   * 200 phút công lúc đặt → đề xuất tối đa 260 phút.
   */
  async function confirmedBooking(startInMinutes = 20) {
    codeSeq += 1;
    const startAt = new Date(Date.now() + startInMinutes * MINUTE);
    const booking = await prisma.booking.create({
      data: {
        code: `BKS${codeSeq}`,
        customerId,
        serviceId,
        wardId,
        zoneId,
        serviceName: 'Tổng vệ sinh',
        addressText: 'Số 12, Phường Một, Tỉnh A',
        contactName: 'Khách A',
        contactPhone: '0912345678',
        startAt,
        endAt: new Date(startAt.getTime() + 120 * MINUTE),
        manMinutes: 200,
        originalManMinutes: 200,
        staffCount: 2,
        durationMinutes: 120,
        minCharge: 500_000,
        itemsTotal: 1_500_000,
        subtotal: 1_500_000,
        totalPrice: 1_500_000,
        items: {
          create: {
            serviceItemId: floorId,
            nameSnapshot: 'Sàn',
            unit: PricingUnit.M2,
            unitPrice: 15_000,
            minutesPerUnit: 2,
            quantity: 100,
            amount: 1_500_000,
          },
        },
      },
    });
    await request(server)
      .put(`/api/v1/admin/bookings/${booking.id}/assignments`)
      .set(admin)
      .send({ staffIds: [leaderId, memberId], leaderId, version: 0 })
      .expect(200);
    return booking.id;
  }

  const staffCall = (
    method: 'patch' | 'post',
    token: Record<string, string>,
    id: number,
    action: string,
    body: object = {},
  ) =>
    request(server)
      [method](`/api/v1/staff/bookings/${id}/${action}`)
      .set(token)
      .send(body);

  const checkIn = (id: number, token = leader) =>
    staffCall('patch', token, id, 'check-in');
  const propose = (
    id: number,
    items: { serviceItemId: number; proposedQuantity: number }[],
    token = leader,
  ) => staffCall('post', token, id, 'adjustment', { items });
  const respond = (id: number, accept: boolean) =>
    request(server)
      .patch(`/api/v1/bookings/${id}/adjustment`)
      .set(customer)
      .send({ accept });

  const moveStart = (id: number, minutesFromNow: number) => {
    const startAt = new Date(Date.now() + minutesFromNow * MINUTE);
    return prisma.booking.update({
      where: { id },
      data: { startAt, endAt: new Date(startAt.getTime() + 120 * MINUTE) },
    });
  };

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
    const service = await prisma.service.create({
      data: { name: 'Tổng vệ sinh', slug: 'tong-ve-sinh', minCharge: 500_000 },
    });
    serviceId = service.id;
    const item = (
      name: string,
      unit: PricingUnit,
      unitPrice: number,
      minutesPerUnit: number,
      extra: object = {},
    ) =>
      prisma.serviceItem.create({
        data: {
          serviceId,
          name,
          unit,
          unitPrice,
          minutesPerUnit,
          maxQty: 2000,
          ...extra,
        },
      });
    floorId = (
      await item('Sàn', PricingUnit.M2, 15_000, 2, {
        minQty: 20,
        isRequired: true,
      })
    ).id;
    sofaId = (await item('Sofa', PricingUnit.UNIT, 350_000, 30)).id;
    curtainId = (
      await item('Rèm', PricingUnit.UNIT, 100_000, 10, { isActive: false })
    ).id;
    ({ token: leader, id: leaderId } = await staffAccount(
      'leader@example.com',
      '0911000001',
    ));
    ({ token: member, id: memberId } = await staffAccount(
      'member@example.com',
      '0911000002',
    ));
    ({ token: outsider } = await staffAccount(
      'outsider@example.com',
      '0911000003',
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('phân quyền', () => {
    it('không token → 401; CUSTOMER, ADMIN → 403', async () => {
      const id = await confirmedBooking();
      const route = `/api/v1/staff/bookings/${id}`;
      await request(server).get(route).expect(401);
      await request(server).get(route).set(customer).expect(403);
      await request(server).get(route).set(admin).expect(403);
    });

    it('IDOR: nhân viên không được giao → 403; đơn không có → 404', async () => {
      const id = await confirmedBooking();
      await request(server)
        .get(`/api/v1/staff/bookings/${id}`)
        .set(outsider)
        .expect(403);
      await checkIn(id, outsider).expect(403);
      await staffCall('patch', outsider, id, 'decline', {
        reason: 'Không rảnh',
      }).expect(403);
      await request(server)
        .get('/api/v1/staff/bookings/999999')
        .set(outsider)
        .expect(404);
    });

    it('thành viên thường gọi API của trưởng nhóm → 403', async () => {
      const id = await confirmedBooking();
      await checkIn(id, member).expect(403);
      await staffCall('patch', member, id, 'no-show').expect(403);
      await checkIn(id).expect(200);
      await propose(
        id,
        [{ serviceItemId: floorId, proposedQuantity: 110 }],
        member,
      ).expect(403);
      await staffCall('patch', member, id, 'complete').expect(403);
      await staffCall('patch', member, id, 'confirm-payment', {
        method: 'CASH',
      }).expect(403);
    });
  });

  describe('lịch làm việc (S01)', () => {
    it('theo khoảng ngày, có liên hệ khách và vai trò trưởng nhóm', async () => {
      const id = await confirmedBooking(24 * 60);
      const tomorrow = dayjs().tz(TZ).add(1, 'day').format('YYYY-MM-DD');
      const today = dayjs().tz(TZ).format('YYYY-MM-DD');
      const list = async (
        token: Record<string, string>,
        from: string,
        to: string,
      ) =>
        dataOf<StaffBookingSummaryView[]>(
          await request(server)
            .get(`/api/v1/staff/bookings?from=${from}&to=${to}`)
            .set(token)
            .expect(200),
        );
      const mine = await list(leader, today, tomorrow);
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({
        id,
        isLeader: true,
        contactPhone: '0912345678',
      });
      expect((await list(member, today, tomorrow))[0].isLeader).toBe(false);
      expect(await list(outsider, today, tomorrow)).toEqual([]);
      expect(await list(leader, today, today)).toEqual(
        dayjs().tz(TZ).add(1, 'day').isSame(dayjs().tz(TZ), 'day') ? mine : [],
      );
    });

    it('khoảng ngày sai → 422; định dạng sai → 400', async () => {
      await request(server)
        .get('/api/v1/staff/bookings?from=2026-11-01&to=2026-12-15')
        .set(leader)
        .expect(422);
      await request(server)
        .get('/api/v1/staff/bookings?from=2026-11-05&to=2026-11-01')
        .set(leader)
        .expect(422);
      await request(server)
        .get('/api/v1/staff/bookings?from=01/11/2026&to=2026-11-05')
        .set(leader)
        .expect(400);
    });
  });

  describe('luồng đầy đủ', () => {
    it('CONFIRMED → IN_PROGRESS → điều chỉnh → COMPLETED → PAID', async () => {
      const id = await confirmedBooking();

      const checkedIn = dataOf<StaffBookingDetailView>(
        await checkIn(id).expect(200),
      );
      expect(checkedIn).toMatchObject({
        status: 'IN_PROGRESS',
        isLeader: true,
        maxAdjustedManMinutes: 260,
      });
      expect(checkedIn.adjustableItems.map((i) => i.id).sort()).toEqual(
        [floorId, sofaId].sort(),
      );

      // 110 m² (220) + 1 sofa (30) = 250 phút ≤ 260.
      const proposed = dataOf<StaffBookingDetailView>(
        await propose(id, [
          { serviceItemId: floorId, proposedQuantity: 110 },
          { serviceItemId: sofaId, proposedQuantity: 1 },
        ]).expect(200),
      );
      expect(proposed.adjustmentStatus).toBe('PENDING');
      expect(proposed.items).toHaveLength(1);

      // A05: một đề xuất đang chờ; S05: chưa hoàn thành được.
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 105 },
      ]).expect(422);
      await staffCall('patch', leader, id, 'complete').expect(422);

      const seen = dataOf<BookingDetailView>(
        await request(server)
          .get(`/api/v1/bookings/${id}`)
          .set(customer)
          .expect(200),
      );
      expect(seen.totalPrice).toBe(1_500_000);
      expect(seen.proposal).toMatchObject({
        total: 2_000_000,
        manMinutes: 250,
      });
      expect(seen.proposal!.lines).toHaveLength(2);

      const accepted = dataOf<BookingDetailView>(
        await respond(id, true).expect(200),
      );
      expect(accepted).toMatchObject({
        adjustmentStatus: 'ACCEPTED',
        totalPrice: 2_000_000,
        itemsTotal: 2_000_000,
        manMinutes: 250,
        proposal: null,
      });
      expect(
        accepted.items.map((i) => [i.nameSnapshot, i.quantity, i.amount]),
      ).toEqual([
        ['Sàn', 110, 1_650_000],
        ['Sofa', 1, 350_000],
      ]);

      const done = dataOf<StaffBookingDetailView>(
        await staffCall('patch', leader, id, 'complete').expect(200),
      );
      expect(done.status).toBe('COMPLETED');

      const paid = dataOf<StaffBookingDetailView>(
        await staffCall('patch', leader, id, 'confirm-payment', {
          method: 'BANK_TRANSFER',
        }).expect(200),
      );
      expect(paid).toMatchObject({
        paymentStatus: 'PAID',
        paymentMethod: 'BANK_TRANSFER',
      });
      await staffCall('patch', leader, id, 'confirm-payment', {
        method: 'CASH',
      }).expect(422);

      const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
      expect(row.paidConfirmedBy).toBe(leaderId);
      const actions = await prisma.bookingStatusHistory.findMany({
        where: { bookingId: id },
        orderBy: { id: 'asc' },
      });
      expect(actions.map((h) => h.action)).toEqual([
        'ASSIGN',
        'CHECK_IN',
        'ADJUST',
        'ADJUST',
        'COMPLETE',
        'PAYMENT',
      ]);
    });

    it('A04 dựa trên phút công lúc đặt: điều chỉnh lần hai không cộng dồn', async () => {
      const id = await confirmedBooking();
      await checkIn(id).expect(200);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 130 },
      ]).expect(200);
      await respond(id, true).expect(200);
      // 131 m² = 262 phút > 260 (30% của 200), dù chỉ tăng 1 m² so với hiện tại.
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 131 },
      ]).expect(422);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 90 },
      ]).expect(200);
    });

    it('từ chối giữ khối lượng đã đặt, xóa hạng mục mới; đề xuất lại được', async () => {
      const id = await confirmedBooking();
      await checkIn(id).expect(200);
      await propose(id, [
        { serviceItemId: sofaId, proposedQuantity: 2 },
      ]).expect(200);
      const rejected = dataOf<BookingDetailView>(
        await respond(id, false).expect(200),
      );
      expect(rejected).toMatchObject({
        adjustmentStatus: 'REJECTED',
        totalPrice: 1_500_000,
        manMinutes: 200,
      });
      expect(await prisma.bookingItem.count({ where: { bookingId: id } })).toBe(
        1,
      );
      expect(
        (
          await prisma.bookingItem.findFirstOrThrow({
            where: { bookingId: id },
          })
        ).proposedQuantity,
      ).toBeNull();
      await respond(id, true).expect(422);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 120 },
      ]).expect(200);
    });

    it('A02, A04: hạng mục đã tắt, vượt 30%, bỏ hạng mục bắt buộc → 422; nhập giá → 400', async () => {
      const id = await confirmedBooking();
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 110 },
      ]).expect(422);
      await checkIn(id).expect(200);
      await propose(id, [
        { serviceItemId: curtainId, proposedQuantity: 1 },
      ]).expect(422);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 131 },
      ]).expect(422);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 0 },
      ]).expect(422);
      await staffCall('post', leader, id, 'adjustment', {
        items: [
          { serviceItemId: floorId, proposedQuantity: 110, unitPrice: 1 },
        ],
      }).expect(400);
    });

    it('A03: admin xác nhận thay khách, lịch sử ghi người xác nhận', async () => {
      const id = await confirmedBooking();
      await checkIn(id).expect(200);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 120 },
      ]).expect(200);
      const res = await request(server)
        .patch(`/api/v1/admin/bookings/${id}/adjustment`)
        .set(admin)
        .send({ accept: true })
        .expect(200);
      expect(dataOf<AdminBookingDetailView>(res)).toMatchObject({
        adjustmentStatus: 'ACCEPTED',
        totalPrice: 1_800_000,
      });
      const last = await prisma.bookingStatusHistory.findFirstOrThrow({
        where: { bookingId: id },
        orderBy: { id: 'desc' },
      });
      const adminUser = await prisma.user.findFirstOrThrow({
        where: { role: UserRole.ADMIN },
      });
      expect(last.changedBy).toBe(adminUser.id);
      expect(last.note).toMatch(/Quản trị xác nhận thay khách/);
    });

    it('khách khác không xác nhận được đề xuất (IDOR)', async () => {
      const id = await confirmedBooking();
      await checkIn(id).expect(200);
      await propose(id, [
        { serviceItemId: floorId, proposedQuantity: 120 },
      ]).expect(200);
      const other = bearer(
        await loginAs(prisma, server, UserRole.CUSTOMER, {
          email: 'other@example.com',
          phone: '0922222222',
        }),
      );
      await request(server)
        .patch(`/api/v1/bookings/${id}/adjustment`)
        .set(other)
        .send({ accept: true })
        .expect(403);
    });
  });

  describe('check-in (S03)', () => {
    it('ngoài cửa sổ thời gian → 422', async () => {
      // Tạo đơn muộn trước rồi lùi giờ, để hai đơn của cùng nhóm không chồng lịch.
      const late = await confirmedBooking();
      await moveStart(late, -90);
      await checkIn(late).expect(422);
      const early = await confirmedBooking(150);
      await checkIn(early).expect(422);
    });

    it('admin hủy đúng lúc trưởng nhóm check-in: chỉ một bên thành công', async () => {
      for (let round = 0; round < 5; round += 1) {
        // Đơn vòng trước vẫn giữ lịch của nhóm nếu đã check-in.
        await prisma.bookingAssignment.deleteMany();
        await prisma.bookingStatusHistory.deleteMany();
        await prisma.bookingItem.deleteMany();
        await prisma.booking.deleteMany();
        const id = await confirmedBooking();
        const [checkedIn, cancelled] = await Promise.all([
          checkIn(id),
          request(server)
            .patch(`/api/v1/admin/bookings/${id}/cancel`)
            .set(admin)
            .send({ reason: 'ADMIN_DECISION' }),
        ]);
        const statuses = [checkedIn.status, cancelled.status];
        expect(statuses.filter((s) => s === 200)).toHaveLength(1);
        const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
        expect(row.status).toBe(
          checkedIn.status === 200 ? 'IN_PROGRESS' : 'CANCELLED',
        );
      }
    });
  });

  describe('từ chối việc (S02)', () => {
    it('gỡ riêng người từ chối, đơn về PENDING, ghi lý do', async () => {
      const id = await confirmedBooking();
      await staffCall('patch', member, id, 'decline', {
        reason: 'Ốm đột xuất',
      }).expect(200);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id },
        include: { assignments: true },
      });
      expect(row.status).toBe(BookingStatus.PENDING);
      expect(row.assignments.map((a) => a.staffId)).toEqual([leaderId]);
      const last = await prisma.bookingStatusHistory.findFirstOrThrow({
        where: { bookingId: id },
        orderBy: { id: 'desc' },
      });
      expect(last).toMatchObject({
        action: 'DECLINE',
        fromStatus: 'CONFIRMED',
        toStatus: 'PENDING',
        changedBy: memberId,
        note: 'Ốm đột xuất',
      });
      // Người đã rời đơn không còn quyền.
      await request(server)
        .get(`/api/v1/staff/bookings/${id}`)
        .set(member)
        .expect(403);
    });

    it('thiếu lý do → 400; đơn đang thực hiện → 422', async () => {
      const id = await confirmedBooking();
      await staffCall('patch', member, id, 'decline', {}).expect(400);
      await checkIn(id).expect(200);
      await staffCall('patch', member, id, 'decline', {
        reason: 'Bận việc',
      }).expect(422);
    });

    it('trưởng nhóm từ chối: admin chỉ định trưởng nhóm mới khi phân công lại', async () => {
      const id = await confirmedBooking();
      await staffCall('patch', leader, id, 'decline', {
        reason: 'Bận việc gia đình',
      }).expect(200);
      const detail = dataOf<AdminBookingDetailView>(
        await request(server)
          .get(`/api/v1/admin/bookings/${id}`)
          .set(admin)
          .expect(200),
      );
      expect(detail.team).toEqual([
        expect.objectContaining({ id: memberId, isLeader: false }),
      ]);
    });
  });

  describe('khách vắng mặt (S07)', () => {
    it('sau 30 phút: hủy, lý do CUSTOMER_NO_SHOW, tính hủy muộn', async () => {
      const id = await confirmedBooking();
      await moveStart(id, -40);
      const res = await staffCall('patch', leader, id, 'no-show').expect(200);
      expect(dataOf<StaffBookingDetailView>(res)).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'CUSTOMER_NO_SHOW',
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: customerId },
      });
      expect(user.lateCancelCount).toBe(1);
    });

    it('chưa đủ 30 phút → 422', async () => {
      const id = await confirmedBooking();
      await moveStart(id, -10);
      await staffCall('patch', leader, id, 'no-show').expect(422);
    });
  });

  describe('admin thu tiền thay (A06)', () => {
    it('chỉ khi COMPLETED; ghi người xác nhận là admin', async () => {
      const id = await confirmedBooking();
      const pay = () =>
        request(server)
          .patch(`/api/v1/admin/bookings/${id}/confirm-payment`)
          .set(admin)
          .send({ method: 'CASH' });
      await pay().expect(422);
      await checkIn(id).expect(200);
      await staffCall('patch', leader, id, 'complete').expect(200);
      const res = await pay().expect(200);
      expect(dataOf<AdminBookingDetailView>(res)).toMatchObject({
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
      });
      await request(server)
        .patch(`/api/v1/admin/bookings/${id}/confirm-payment`)
        .set(admin)
        .send({ method: 'VISA' })
        .expect(400);
    });
  });
});
