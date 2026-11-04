import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import dayjs from 'dayjs';
import { toZoned } from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';

const TZ = 'Asia/Ho_Chi_Minh';
const CONFIG: Record<string, unknown> = {
  timezone: TZ,
  'booking.serviceOpenHour': 7,
  'booking.serviceCloseHour': 20,
  'booking.slotStepMinutes': 30,
  'booking.minLeadHours': 3,
  'booking.maxAdvanceDays': 14,
  'booking.staffBufferMinutes': 30,
};

const DATE = '2026-11-02';
// Trước DATE vài ngày để quy tắc báo trước không ảnh hưởng.
const NOW = new Date('2026-10-30T00:00:00.000Z');
const at = (time: string) => dayjs.tz(`${DATE} ${time}`, TZ).toDate();
const label = (date: Date) => toZoned(date, TZ).format('HH:mm');

function setup() {
  const db = {
    user: { findMany: jest.fn().mockResolvedValue([{ id: 1 }]) },
    staffUnavailability: { findMany: jest.fn().mockResolvedValue([]) },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    bookingAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    blockedDate: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const service = new AvailabilityService(
    db as unknown as PrismaService,
    { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService,
  );
  return { db, service };
}

describe('AvailabilityService', () => {
  describe('listStartTimes', () => {
    it('T01: từ giờ mở cửa, bước 30 phút, kết thúc không quá 20:00', async () => {
      const { service } = setup();
      const starts = await service.listStartTimes(1, DATE, 1, 120, NOW);
      expect(label(starts[0])).toBe('07:00');
      expect(label(starts[1])).toBe('07:30');
      expect(label(starts[starts.length - 1])).toBe('18:00');
    });

    it('T07: 07:00 Việt Nam là 00:00 UTC cùng ngày', async () => {
      const { service } = setup();
      const [first] = await service.listStartTimes(1, DATE, 1, 60, NOW);
      expect(first.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    });

    it('thời lượng dài hơn giờ phục vụ → không có giờ nào', async () => {
      const { service } = setup();
      expect(await service.listStartTimes(1, DATE, 1, 800, NOW)).toEqual([]);
    });

    it('T02: giờ đầu tiên cách hiện tại ít nhất 3 giờ', async () => {
      const { service } = setup();
      const now = at('09:15');
      const starts = await service.listStartTimes(1, DATE, 1, 60, now);
      expect(label(starts[0])).toBe('12:30');
    });

    it('T02: đúng 3 giờ vẫn được đặt', async () => {
      const { service } = setup();
      const starts = await service.listStartTimes(1, DATE, 1, 60, at('09:00'));
      expect(label(starts[0])).toBe('12:00');
    });

    it('T02: ngày quá 14 ngày → rỗng; đúng 14 ngày còn các giờ trước mốc', async () => {
      const { service } = setup();
      const now = dayjs.tz('2026-10-19 10:00', TZ).toDate();
      const starts = await service.listStartTimes(1, DATE, 1, 60, now);
      expect(label(starts[starts.length - 1])).toBe('10:00');
      expect(await service.listStartTimes(1, '2026-11-03', 1, 60, now)).toEqual(
        [],
      );
    });

    it('T04: không đủ nhân viên → không có giờ', async () => {
      const { service } = setup();
      expect(await service.listStartTimes(1, DATE, 2, 60, NOW)).toEqual([]);
    });

    it('T04: chỉ lấy nhân viên ACTIVE thuộc khu vực', async () => {
      const { db, service } = setup();
      await service.listStartTimes(9, DATE, 1, 60, NOW);
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'STAFF',
            status: 'ACTIVE',
            staffZones: { some: { zoneId: 9 } },
          },
        }),
      );
    });

    it('T04: giờ trùng lịch nghỉ bị loại, sát lịch nghỉ thì còn', async () => {
      const { db, service } = setup();
      db.staffUnavailability.findMany.mockResolvedValue([
        { staffId: 1, startAt: at('10:00'), endAt: at('12:00') },
      ]);
      const labels = (await service.listStartTimes(1, DATE, 1, 60, NOW)).map(
        label,
      );
      expect(labels).toContain('09:00');
      expect(labels).not.toContain('09:30');
      expect(labels).not.toContain('11:30');
      expect(labels).toContain('12:00');
    });

    it('T03, T05: đơn PENDING chồng giờ chiếm chỗ, tính cả buffer 30 phút', async () => {
      const { db, service } = setup();
      db.booking.findMany.mockResolvedValue([
        { startAt: at('10:00'), endAt: at('12:00'), staffCount: 1 },
      ]);
      const labels = (await service.listStartTimes(1, DATE, 1, 60, NOW)).map(
        label,
      );
      expect(labels).toContain('08:30'); // kết thúc 09:30, đủ buffer
      expect(labels).not.toContain('09:00'); // kết thúc 10:00, thiếu buffer
      expect(labels).not.toContain('12:00'); // ngay sau đơn, thiếu buffer
      expect(labels).toContain('12:30');
    });

    it('T03, T04: nhân viên đã được giao đơn chồng giờ không còn rảnh', async () => {
      const { db, service } = setup();
      db.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      db.bookingAssignment.findMany.mockResolvedValue([
        {
          staffId: 1,
          booking: { startAt: at('10:00'), endAt: at('12:00') },
        },
      ]);
      const labels = (await service.listStartTimes(1, DATE, 2, 60, NOW)).map(
        label,
      );
      expect(labels).toContain('08:30');
      expect(labels).not.toContain('09:00');
      expect(labels).not.toContain('12:00');
      expect(labels).toContain('12:30');
    });

    it('T04: một nhân viên vừa nghỉ vừa có đơn chỉ tính một lần', async () => {
      const { db, service } = setup();
      db.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      db.staffUnavailability.findMany.mockResolvedValue([
        { staffId: 1, startAt: at('07:00'), endAt: at('20:00') },
      ]);
      db.bookingAssignment.findMany.mockResolvedValue([
        { staffId: 1, booking: { startAt: at('10:00'), endAt: at('12:00') } },
      ]);
      expect(
        (await service.listStartTimes(1, DATE, 1, 60, NOW)).length,
      ).toBeGreaterThan(0);
    });

    it('T08: ngày không phục vụ → không có giờ nào', async () => {
      const { db, service } = setup();
      db.blockedDate.findUnique.mockResolvedValue({ reason: 'Nghỉ lễ' });
      expect(await service.listStartTimes(1, DATE, 1, 60, NOW)).toEqual([]);
      expect(db.blockedDate.findUnique).toHaveBeenCalledWith({
        where: { date: new Date('2026-11-02T00:00:00.000Z') },
        select: { reason: true },
      });
    });

    it('R01: đổi lịch không tính chính đơn đang đổi', async () => {
      const { db, service } = setup();
      await service.listStartTimes(1, DATE, 1, 60, NOW, 42);
      const pendingWhere = (
        db.booking.findMany.mock.calls[0] as [{ where: { id: unknown } }]
      )[0].where;
      expect(pendingWhere.id).toEqual({ not: 42 });
      const assignedWhere = (
        db.bookingAssignment.findMany.mock.calls[0] as [
          { where: { bookingId: unknown } },
        ]
      )[0].where;
      expect(assignedWhere.bookingId).toEqual({ not: 42 });
    });

    it('T05: trừ đúng staff_count của đơn PENDING', async () => {
      const { db, service } = setup();
      db.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      db.booking.findMany.mockResolvedValue([
        { startAt: at('07:00'), endAt: at('20:00'), staffCount: 2 },
      ]);
      expect(await service.listStartTimes(1, DATE, 2, 60, NOW)).toEqual([]);
      expect(
        (await service.listStartTimes(1, DATE, 1, 60, NOW)).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('assertStartTimeAllowed', () => {
    const { service } = setup();

    it('chấp nhận giờ hợp lệ, biên kết thúc đúng 20:00', () => {
      expect(() =>
        service.assertStartTimeAllowed(at('18:00'), 120, NOW),
      ).not.toThrow();
    });

    it.each([
      ['lệch bước 30 phút', '09:15', 60],
      ['trước giờ mở cửa', '06:30', 60],
      ['kết thúc sau 20:00', '18:30', 120],
    ])('%s → 422', (_name, time, duration) => {
      expect(() =>
        service.assertStartTimeAllowed(at(time), duration, NOW),
      ).toThrow(UnprocessableEntityException);
    });

    it('T02: dưới 3 giờ hoặc quá 14 ngày → 422', () => {
      expect(() =>
        service.assertStartTimeAllowed(at('10:00'), 60, at('07:30')),
      ).toThrow(/tối thiểu 3 giờ/);
      expect(() =>
        service.assertStartTimeAllowed(
          at('10:00'),
          60,
          dayjs.tz('2026-10-10 10:00', TZ).toDate(),
        ),
      ).toThrow(/tối đa 14 ngày/);
    });
  });

  describe('assertNotBlocked (T08)', () => {
    it('ngày theo múi giờ nghiệp vụ, không theo UTC', async () => {
      const { db, service } = setup();
      db.blockedDate.findUnique.mockResolvedValue({ reason: 'Nghỉ lễ' });
      // 06:30 ngày 03/11 giờ Việt Nam là 23:30 UTC ngày 02/11.
      const startAt = dayjs.tz('2026-11-03 06:30', TZ).toDate();
      await expect(
        service.assertNotBlocked(db as never, startAt),
      ).rejects.toThrow(/không phục vụ: Nghỉ lễ/);
      expect(db.blockedDate.findUnique).toHaveBeenCalledWith({
        where: { date: new Date('2026-11-03T00:00:00.000Z') },
        select: { reason: true },
      });
    });
  });

  it('isSlotAvailable: dùng client được truyền vào', async () => {
    const { db, service } = setup();
    const tx = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 1 }]) },
      staffUnavailability: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { findMany: jest.fn().mockResolvedValue([]) },
      bookingAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await expect(
      service.isSlotAvailable(tx as never, 1, at('09:00'), 2, 60),
    ).resolves.toBe(false);
    expect(tx.user.findMany).toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});
