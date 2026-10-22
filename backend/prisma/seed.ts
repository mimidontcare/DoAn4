/**
 * Seed dữ liệu ban đầu:
 * - Tài khoản: 1 admin và 1 nhân viên mẫu (U01: do hệ thống tạo, bắt đổi mật khẩu
 *   lần đầu). Thông tin đọc từ biến SEED_* trong .env, không hardcode.
 * - Vùng phục vụ: prisma/data/areas/<tỉnh>.json (Z03: tên tỉnh chỉ nằm trong dữ liệu seed).
 * - Dịch vụ demo: prisma/data/services.json.
 * Chạy lại nhiều lần an toàn: bản ghi đã có (theo email, code, slug, tên khu vực)
 * thì giữ nguyên, không ghi đè thay đổi admin đã làm.
 *
 *   npx prisma db seed
 */
import { PricingUnit, PrismaClient, UserRole, WardType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

const AREA_FILES = ['ha-noi.json'];

interface WardSeed {
  code: string;
  name: string;
  type: WardType;
  oldNameHint?: string;
}

interface AreaSeed {
  province: { code: string; name: string };
  zones: { name: string; wards: WardSeed[] }[];
  unassignedWards: WardSeed[];
}

interface ServiceSeed {
  name: string;
  slug: string;
  description: string;
  minCharge: number;
  sortOrder: number;
  items: {
    name: string;
    unit: PricingUnit;
    unitPrice: number;
    minutesPerUnit: number;
    minQty: number;
    maxQty: number;
    isRequired: boolean;
    sortOrder: number;
  }[];
}

function readData<T>(...path: string[]): T {
  return JSON.parse(
    readFileSync(join(__dirname, 'data', ...path), 'utf8'),
  ) as T;
}

interface SeedAccount {
  role: UserRole;
  envPrefix: string;
}

const ACCOUNTS: SeedAccount[] = [
  { role: UserRole.ADMIN, envPrefix: 'SEED_ADMIN' },
  { role: UserRole.STAFF, envPrefix: 'SEED_STAFF' },
];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name} (xem .env.example)`);
  }
  return value;
}

async function seedAccount({ role, envPrefix }: SeedAccount, rounds: number) {
  const email = requireEnv(`${envPrefix}_EMAIL`).toLowerCase();
  const password = requireEnv(`${envPrefix}_PASSWORD`);
  if (password.length < 8) {
    throw new Error(`${envPrefix}_PASSWORD phải có ít nhất 8 ký tự`);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    console.log(`= ${role} ${email} đã tồn tại, bỏ qua`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      phone: requireEnv(`${envPrefix}_PHONE`),
      fullName: requireEnv(`${envPrefix}_NAME`),
      passwordHash: await bcrypt.hash(password, rounds),
      role,
      mustChangePassword: true,
    },
  });
  console.log(`+ Đã tạo ${role} ${email}`);
}

async function seedArea(file: string) {
  const data = readData<AreaSeed>('areas', file);

  let province = await prisma.province.findUnique({
    where: { code: data.province.code },
    select: { id: true },
  });
  if (!province) {
    // Z02: chỉ bật tỉnh mới khi chưa có tỉnh nào hoạt động.
    const hasActive = await prisma.province.count({ where: { isActive: true } });
    province = await prisma.province.create({
      data: { ...data.province, isActive: hasActive === 0 },
      select: { id: true },
    });
    console.log(`+ Đã tạo tỉnh ${data.province.name}`);
  }
  const provinceId = province.id;

  const createWard = async (ward: WardSeed, zoneId: number | null) => {
    const existing = await prisma.ward.findUnique({
      where: { code: ward.code },
      select: { id: true },
    });
    if (existing) return 0;
    // Z01: chỉ phường thuộc khu vực mới được bật.
    await prisma.ward.create({
      data: { ...ward, provinceId, zoneId, isActive: zoneId !== null },
    });
    return 1;
  };

  let created = 0;
  for (const zoneSeed of data.zones) {
    const zone =
      (await prisma.serviceZone.findUnique({
        where: { provinceId_name: { provinceId, name: zoneSeed.name } },
        select: { id: true },
      })) ??
      (await prisma.serviceZone.create({
        data: { provinceId, name: zoneSeed.name },
        select: { id: true },
      }));
    for (const ward of zoneSeed.wards) {
      created += await createWard(ward, zone.id);
    }
  }
  for (const ward of data.unassignedWards) {
    created += await createWard(ward, null);
  }
  console.log(`= ${data.province.name}: thêm mới ${created} phường/xã`);
}

async function seedServices() {
  const { services } = readData<{ services: ServiceSeed[] }>('services.json');
  for (const { items, ...service } of services) {
    const existing = await prisma.service.findUnique({
      where: { slug: service.slug },
      select: { id: true },
    });
    if (existing) {
      console.log(`= Dịch vụ ${service.slug} đã tồn tại, bỏ qua`);
      continue;
    }
    await prisma.service.create({
      data: { ...service, items: { create: items } },
    });
    console.log(`+ Đã tạo dịch vụ ${service.slug} (${items.length} hạng mục)`);
  }
}

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
  for (const account of ACCOUNTS) {
    await seedAccount(account, rounds);
  }
  for (const file of AREA_FILES) {
    await seedArea(file);
  }
  await seedServices();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
