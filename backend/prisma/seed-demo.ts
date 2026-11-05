/**
 * Seed dữ liệu demo (Phase 8): khách, nhân viên, đơn ở đủ trạng thái để chạy
 * kịch bản trong docs/DEMO_SCRIPT.md. Thời gian tính theo lúc chạy script.
 *
 * Điều kiện: đã chạy `npx prisma db seed` (tỉnh, phường/xã, dịch vụ, admin).
 * Chỉ thêm dữ liệu, không xóa; từ chối chạy khi database đã có đơn đặt lịch.
 * Mật khẩu tài khoản demo đọc từ SEED_DEMO_PASSWORD (không hardcode).
 *
 *   npm run seed:demo
 */
import {
  AdjustmentStatus,
  BookingAction,
  BookingStatus,
  CancelReason,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { totalsOf } from '../src/bookings/pricing.service';
import { isWeekendInZone } from '../src/common/utils/time';

const prisma = new PrismaClient();

const SERVICE_SLUG = 'tong-ve-sinh-nha-dang-o';
const DEMO_DOMAIN = 'demo.local';
const MS_PER_MINUTE = 60_000;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem .env.example)`);
  }
  return value;
}

const env = {
  tz: requireEnv('APP_TIMEZONE'),
  password: requireEnv('SEED_DEMO_PASSWORD'),
  rounds: Number(process.env.BCRYPT_ROUNDS ?? 10),
  manMinutesPerStaff: Number(process.env.MAN_MINUTES_PER_STAFF ?? 240),
  weekendPercent: Number(process.env.WEEKEND_SURCHARGE_PERCENT ?? 10),
  step: Number(process.env.BOOKING_SLOT_STEP_MINUTES ?? 30),
};

/** Giờ địa phương của ngày cách hôm nay `days` ngày. */
const localAt = (days: number, time: string) =>
  dayjs
    .tz(
      `${dayjs().tz(env.tz).add(days, 'day').format('YYYY-MM-DD')} ${time}`,
      env.tz,
    )
    .toDate();
/** Mốc tương đối với hiện tại, làm tròn xuống bước giờ. */
const minutesFromNow = (minutes: number) => {
  const step = env.step * MS_PER_MINUTE;
  return new Date(
    Math.floor((Date.now() + minutes * MS_PER_MINUTE) / step) * step,
  );
};

async function main() {
  if ((await prisma.booking.count()) > 0) {
    throw new Error(
      'Database đã có đơn đặt lịch; seed demo chỉ chạy trên database mới (xem README).',
    );
  }
  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  const service = await prisma.service.findUnique({
    where: { slug: SERVICE_SLUG },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  const zones = await prisma.serviceZone.findMany({
    where: { province: { isActive: true }, isActive: true },
    orderBy: { id: 'asc' },
    include: { wards: { where: { isActive: true }, orderBy: { id: 'asc' } } },
  });
  const outside = await prisma.ward.findFirst({
    where: { zoneId: null },
    select: { id: true, name: true },
  });
  if (!admin || !service || zones.length < 2 || !outside) {
    throw new Error('Chưa có dữ liệu nền: chạy `npx prisma db seed` trước.');
  }
  const [center, west] = zones;
  const floor = service.items[0];
  const passwordHash = await bcrypt.hash(env.password, env.rounds);

  // ---------- Tài khoản ----------
  const user = (
    key: string,
    fullName: string,
    phone: string,
    role: UserRole,
    extra: Partial<Prisma.UserCreateInput> = {},
  ) =>
    prisma.user.create({
      data: {
        email: `${key}@${DEMO_DOMAIN}`,
        phone,
        fullName,
        passwordHash,
        role,
        ...extra,
      },
    });
  const staffIn = (zoneId: number) => ({
    staffZones: { create: { zoneId } },
  });
  const an = await user(
    'nv.an',
    'Nguyễn Văn An',
    '0901000001',
    UserRole.STAFF,
    staffIn(center.id),
  );
  const binh = await user(
    'nv.binh',
    'Trần Thị Bình',
    '0901000002',
    UserRole.STAFF,
    staffIn(center.id),
  );
  const cuong = await user(
    'nv.cuong',
    'Lê Văn Cường',
    '0901000003',
    UserRole.STAFF,
    staffIn(center.id),
  );
  const dung = await user(
    'nv.dung',
    'Phạm Thị Dung',
    '0901000004',
    UserRole.STAFF,
    staffIn(center.id),
  );
  await user(
    'nv.em',
    'Hoàng Văn Em',
    '0901000005',
    UserRole.STAFF,
    staffIn(west.id),
  );
  const lan = await user(
    'khach.lan',
    'Đỗ Thị Lan',
    '0912000001',
    UserRole.CUSTOMER,
  );
  const minh = await user(
    'khach.minh',
    'Vũ Đức Minh',
    '0912000002',
    UserRole.CUSTOMER,
    {
      lateCancelCount: 1,
    },
  );

  // Dung nghỉ cả ngày mai: báo giá ngày mai có ít người rảnh hơn.
  await prisma.staffUnavailability.create({
    data: {
      staffId: dung.id,
      startAt: localAt(1, '00:00'),
      endAt: localAt(2, '00:00'),
      reason: 'Nghỉ phép',
      createdBy: admin.id,
    },
  });

  // ---------- Địa chỉ ----------
  const address = (
    userId: number,
    wardId: number,
    detail: string,
    contactName: string,
    contactPhone: string,
    isDefault: boolean,
  ) =>
    prisma.address.create({
      data: {
        userId,
        wardId,
        detail,
        contactName,
        contactPhone,
        isDefault,
        label: isDefault ? 'Nhà riêng' : 'Nhà bố mẹ',
      },
      include: { ward: { include: { province: true } } },
    });
  const lanHome = await address(
    lan.id,
    center.wards[0].id,
    'Số 12 ngõ 34 Hàng Bạc',
    lan.fullName,
    lan.phone,
    true,
  );
  const minhHome = await address(
    minh.id,
    center.wards[1].id,
    'Số 5 phố Quán Thánh',
    minh.fullName,
    minh.phone,
    true,
  );
  // Phường ngoài vùng phục vụ: hiện "Ngoài vùng phục vụ", không dùng đặt lịch được (Z01).
  await address(
    minh.id,
    outside.id,
    'Thôn Đông',
    minh.fullName,
    minh.phone,
    false,
  );

  // ---------- Đơn đặt lịch ----------
  let seq = 0;
  async function booking(input: {
    customerId: number;
    home: typeof lanHome;
    startAt: Date;
    quantity: number;
    status: BookingStatus;
    team?: { staffId: number; isLeader: boolean }[];
    histories: {
      from: BookingStatus | null;
      to: BookingStatus;
      action: BookingAction;
      by: number | null;
      note?: string;
    }[];
    extra?: Partial<Prisma.BookingUncheckedCreateInput>;
    proposedQuantity?: number;
  }) {
    seq += 1;
    const surchargePercent = isWeekendInZone(input.startAt, env.tz)
      ? env.weekendPercent
      : 0;
    const line = {
      quantity: input.quantity,
      unitPrice: floor.unitPrice,
      minutesPerUnit: floor.minutesPerUnit,
    };
    const totals = totalsOf([line], service!.minCharge, surchargePercent);
    const staffCount = Math.max(
      1,
      Math.ceil(totals.manMinutes / env.manMinutesPerStaff),
    );
    const duration = Math.max(
      env.step,
      Math.ceil(totals.manMinutes / staffCount / env.step) * env.step,
    );
    const { ward } = input.home;
    return prisma.booking.create({
      data: {
        code: `BKDEMO${String(seq).padStart(3, '0')}`,
        customerId: input.customerId,
        serviceId: service!.id,
        wardId: ward.id,
        zoneId: ward.zoneId!,
        serviceName: service!.name,
        addressText: `${input.home.detail}, Phường ${ward.name}, ${ward.province.name}`,
        contactName: input.home.contactName,
        contactPhone: input.home.contactPhone,
        startAt: input.startAt,
        endAt: new Date(input.startAt.getTime() + duration * MS_PER_MINUTE),
        manMinutes: totals.manMinutes,
        originalManMinutes: totals.manMinutes,
        staffCount,
        durationMinutes: duration,
        minCharge: service!.minCharge,
        surchargePercent,
        itemsTotal: totals.itemsTotal,
        subtotal: totals.subtotal,
        surcharge: totals.surcharge,
        totalPrice: totals.total,
        status: input.status,
        version: input.histories.length,
        ...input.extra,
        items: {
          create: {
            serviceItemId: floor.id,
            nameSnapshot: floor.name,
            unit: floor.unit,
            unitPrice: floor.unitPrice,
            minutesPerUnit: floor.minutesPerUnit,
            quantity: input.quantity,
            proposedQuantity: input.proposedQuantity,
            amount: input.quantity * floor.unitPrice,
          },
        },
        assignments: input.team && {
          create: input.team.map((m) => ({ ...m, assignedBy: admin!.id })),
        },
        histories: {
          create: input.histories.map((h, i) => ({
            fromStatus: h.from,
            toStatus: h.to,
            action: h.action,
            changedBy: h.by,
            note: h.note,
            // Lịch sử cách nhau 1 phút, kết thúc trước giờ hiện tại.
            createdAt: new Date(
              Date.now() - (input.histories.length - i) * MS_PER_MINUTE,
            ),
          })),
        },
      },
    });
  }
  const { PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED } =
    BookingStatus;
  const created = { from: null, to: PENDING, action: BookingAction.CREATE };
  const assigned = {
    from: PENDING,
    to: CONFIRMED,
    action: BookingAction.ASSIGN,
    by: admin.id,
  };

  // 1. Chờ phân công (ngày mai): demo dialog phân công.
  await booking({
    customerId: lan.id,
    home: lanHome,
    startAt: localAt(1, '09:00'),
    quantity: 100,
    status: PENDING,
    histories: [{ ...created, by: lan.id }],
  });
  // 2. Đã xác nhận (ngày mai): demo nhân viên từ chối, khách đổi lịch hoặc hủy.
  await booking({
    customerId: lan.id,
    home: lanHome,
    startAt: localAt(1, '14:00'),
    quantity: 80,
    status: CONFIRMED,
    team: [{ staffId: an.id, isLeader: true }],
    histories: [{ ...created, by: lan.id }, assigned],
  });
  // 3. Quá giờ chưa check-in: hiện ở ô "Cần xử lý" của Tổng quan.
  await booking({
    customerId: minh.id,
    home: minhHome,
    startAt: minutesFromNow(-60),
    quantity: 60,
    status: CONFIRMED,
    team: [{ staffId: binh.id, isLeader: true }],
    histories: [{ ...created, by: minh.id }, assigned],
  });
  // 4. Đang làm, có đề xuất điều chỉnh chờ khách xác nhận (A01–A05).
  await booking({
    customerId: lan.id,
    home: lanHome,
    startAt: minutesFromNow(-30),
    quantity: 100,
    status: IN_PROGRESS,
    proposedQuantity: 120,
    team: [{ staffId: cuong.id, isLeader: true }],
    extra: { adjustmentStatus: AdjustmentStatus.PENDING },
    histories: [
      { ...created, by: lan.id },
      assigned,
      {
        from: CONFIRMED,
        to: IN_PROGRESS,
        action: BookingAction.CHECK_IN,
        by: cuong.id,
      },
      {
        from: IN_PROGRESS,
        to: IN_PROGRESS,
        action: BookingAction.ADJUST,
        by: cuong.id,
        note: 'Đề xuất điều chỉnh: 240 phút công',
      },
    ],
  });
  const done = [
    { ...created, by: minh.id },
    assigned,
    {
      from: CONFIRMED,
      to: IN_PROGRESS,
      action: BookingAction.CHECK_IN,
      by: an.id,
    },
    {
      from: IN_PROGRESS,
      to: COMPLETED,
      action: BookingAction.COMPLETE,
      by: an.id,
    },
  ];
  // 5. Hoàn thành hôm qua, chưa thu tiền; khách còn đánh giá được.
  await booking({
    customerId: minh.id,
    home: minhHome,
    startAt: localAt(-1, '08:00'),
    quantity: 90,
    status: COMPLETED,
    team: [{ staffId: an.id, isLeader: true }],
    histories: done,
  });
  // 6. Hoàn thành, đã thu tiền, đã đánh giá; nhóm 2 người (V02).
  const paid = await booking({
    customerId: lan.id,
    home: lanHome,
    startAt: localAt(-2, '08:00'),
    quantity: 200,
    status: COMPLETED,
    team: [
      { staffId: an.id, isLeader: true },
      { staffId: binh.id, isLeader: false },
    ],
    extra: {
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
      paidAt: localAt(-2, '15:00'),
      paidConfirmedBy: an.id,
    },
    histories: [
      ...done.map((h) => ({ ...h, by: h.by === minh.id ? lan.id : h.by })),
      {
        from: COMPLETED,
        to: COMPLETED,
        action: BookingAction.PAYMENT,
        by: an.id,
      },
    ],
  });
  await prisma.review.create({
    data: {
      bookingId: paid.id,
      customerId: lan.id,
      rating: 5,
      comment: 'Nhân viên làm kỹ, đúng giờ, nhà sạch hẳn.',
    },
  });
  // 7. Khách đã hủy.
  await booking({
    customerId: minh.id,
    home: minhHome,
    startAt: localAt(2, '10:00'),
    quantity: 50,
    status: CANCELLED,
    extra: {
      cancelReason: CancelReason.CUSTOMER_REQUEST,
      cancelNote: 'Đổi kế hoạch',
      cancelledBy: minh.id,
      cancelledAt: new Date(),
    },
    histories: [
      { ...created, by: minh.id },
      {
        from: PENDING,
        to: CANCELLED,
        action: BookingAction.CANCEL,
        by: minh.id,
        note: 'Đổi kế hoạch',
      },
    ],
  });

  // Ngày không phục vụ (T08): 5 ngày tới.
  const blocked = dayjs().tz(env.tz).add(5, 'day').format('YYYY-MM-DD');
  await prisma.blockedDate.create({
    data: {
      date: new Date(`${blocked}T00:00:00.000Z`),
      reason: 'Bảo trì thiết bị',
      createdBy: admin.id,
    },
  });

  console.log(
    `+ Đã tạo dữ liệu demo: 7 tài khoản (@${DEMO_DOMAIN}), ${seq} đơn, 1 đánh giá, ngày nghỉ ${blocked}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
