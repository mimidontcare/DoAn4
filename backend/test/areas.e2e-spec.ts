import { INestApplication } from '@nestjs/common';
import { UserRole, WardType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  ProvinceView,
  ServiceAreas,
  WardView,
  ZoneView,
} from '../src/areas/areas.select';
import type { Paginated } from '../src/common/dto/pagination.dto';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  dataOf,
  loginAs,
  resetDatabase,
} from './e2e-helpers';

describe('Vùng phục vụ (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let admin: Record<string, string>;
  let provinceA: number;
  let provinceB: number;

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = bearer(await loginAs(prisma, server, UserRole.ADMIN));
    // Tên tỉnh trong test là dữ liệu giả, không phụ thuộc dữ liệu seed.
    provinceA = (
      await prisma.province.create({
        data: { code: 'T1', name: 'Tỉnh A', isActive: true },
      })
    ).id;
    provinceB = (
      await prisma.province.create({ data: { code: 'T2', name: 'Tỉnh B' } })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createZone(provinceId: number, name: string) {
    const res = await request(server)
      .post('/api/v1/admin/zones')
      .set(admin)
      .send({ provinceId, name })
      .expect(201);
    return dataOf<ZoneView>(res);
  }

  function createWard(provinceId: number, code: string, name: string) {
    return prisma.ward.create({
      data: { provinceId, code, name, type: WardType.PHUONG },
    });
  }

  async function serviceAreas() {
    const res = await request(server).get('/api/v1/service-areas').expect(200);
    return dataOf<ServiceAreas>(res);
  }

  it('admin API: không token → 401, STAFF → 403', async () => {
    await request(server).get('/api/v1/admin/wards').expect(401);
    const staff = await loginAs(prisma, server, UserRole.STAFF);
    await request(server)
      .get('/api/v1/admin/zones')
      .set(bearer(staff))
      .expect(403);
  });

  it('Z02: bật tỉnh B thì tỉnh A tắt', async () => {
    await request(server)
      .patch(`/api/v1/admin/provinces/${provinceB}/activate`)
      .set(admin)
      .expect(200);
    const res = await request(server)
      .get('/api/v1/admin/provinces')
      .set(admin)
      .expect(200);
    const active = dataOf<ProvinceView[]>(res).filter((p) => p.isActive);
    expect(active.map((p) => p.id)).toEqual([provinceB]);
    expect((await serviceAreas()).province?.id).toBe(provinceB);
  });

  it('khu vực: trùng tên trong cùng tỉnh → 409, khác tỉnh thì được', async () => {
    await createZone(provinceA, 'Trung tâm');
    await request(server)
      .post('/api/v1/admin/zones')
      .set(admin)
      .send({ provinceId: provinceA, name: 'Trung tâm' })
      .expect(409);
    await createZone(provinceB, 'Trung tâm');
    await request(server)
      .post('/api/v1/admin/zones')
      .set(admin)
      .send({ provinceId: 999999, name: 'Khu X' })
      .expect(404);
  });

  it('Z01: bật/tắt phường có tác dụng ngay ở /service-areas', async () => {
    const zone = await createZone(provinceA, 'Trung tâm');
    const ward = await createWard(provinceA, 'W1', 'Phường Một');
    expect((await serviceAreas()).zones).toEqual([]);

    // Chưa có khu vực thì không bật được.
    await request(server)
      .patch(`/api/v1/admin/wards/${ward.id}`)
      .set(admin)
      .send({ isActive: true })
      .expect(422);

    await request(server)
      .patch(`/api/v1/admin/wards/${ward.id}`)
      .set(admin)
      .send({ zoneId: zone.id, isActive: true })
      .expect(200);
    const areas = await serviceAreas();
    expect(areas.province?.name).toBe('Tỉnh A');
    expect(areas.zones).toEqual([
      expect.objectContaining({
        name: 'Trung tâm',
        wards: [expect.objectContaining({ code: 'W1' })],
      }),
    ]);

    // Tắt khu vực → phường không còn đặt được.
    await request(server)
      .put(`/api/v1/admin/zones/${zone.id}`)
      .set(admin)
      .send({ isActive: false })
      .expect(200);
    expect((await serviceAreas()).zones).toEqual([]);
    await request(server)
      .put(`/api/v1/admin/zones/${zone.id}`)
      .set(admin)
      .send({ isActive: true })
      .expect(200);

    // Gỡ khỏi khu vực → phường tự tắt.
    const res = await request(server)
      .patch(`/api/v1/admin/wards/${ward.id}`)
      .set(admin)
      .send({ zoneId: null })
      .expect(200);
    expect(dataOf<WardView>(res)).toMatchObject({
      zone: null,
      isActive: false,
    });
    expect((await serviceAreas()).zones).toEqual([]);
  });

  it('gán phường vào khu vực của tỉnh khác → 422', async () => {
    const zoneB = await createZone(provinceB, 'Khu B');
    const ward = await createWard(provinceA, 'W1', 'Phường Một');
    await request(server)
      .patch(`/api/v1/admin/wards/${ward.id}`)
      .set(admin)
      .send({ zoneId: zoneB.id })
      .expect(422);
  });

  it('tỉnh không hoạt động thì phường của tỉnh đó không hiện', async () => {
    const zoneB = await createZone(provinceB, 'Khu B');
    const ward = await createWard(provinceB, 'W2', 'Phường Hai');
    await request(server)
      .patch(`/api/v1/admin/wards/${ward.id}`)
      .set(admin)
      .send({ zoneId: zoneB.id, isActive: true })
      .expect(200);
    const areas = await serviceAreas();
    expect(areas.province?.id).toBe(provinceA);
    expect(areas.zones).toEqual([]);
  });

  it('danh sách phường: lọc, tìm, phân trang; query sai → 400', async () => {
    const zone = await createZone(provinceA, 'Trung tâm');
    await createWard(provinceA, 'W1', 'Phường Một');
    await createWard(provinceA, 'W2', 'Phường Hai');
    await prisma.ward.create({
      data: {
        provinceId: provinceA,
        zoneId: zone.id,
        code: 'W3',
        name: 'Phường Ba',
        type: WardType.PHUONG,
        isActive: true,
      },
    });

    const page = async (query: string) =>
      dataOf<Paginated<WardView>>(
        await request(server)
          .get(`/api/v1/admin/wards?${query}`)
          .set(admin)
          .expect(200),
      );

    expect((await page('unassigned=true')).total).toBe(2);
    expect((await page(`zoneId=${zone.id}`)).items.map((w) => w.code)).toEqual([
      'W3',
    ]);
    expect((await page('isActive=false')).total).toBe(2);
    expect((await page('q=hai')).items.map((w) => w.code)).toEqual(['W2']);
    const first = await page(`provinceId=${provinceA}&page=1&pageSize=2`);
    expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });
    expect(first.items).toHaveLength(2);

    await request(server)
      .get('/api/v1/admin/wards?pageSize=1000')
      .set(admin)
      .expect(400);
    await request(server)
      .get('/api/v1/admin/wards?isActive=yes')
      .set(admin)
      .expect(400);
  });
});
