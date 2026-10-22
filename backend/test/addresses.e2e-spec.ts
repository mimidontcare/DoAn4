import { INestApplication } from '@nestjs/common';
import { UserRole, WardType } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AddressView } from '../src/users/address.select';
import {
  bearer,
  createTestApp,
  dataOf,
  loginAs,
  resetDatabase,
} from './e2e-helpers';

describe('Địa chỉ khách (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let customer: Record<string, string>;
  let inArea: number;
  let outOfArea: number;
  let zoneId: number;

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    customer = bearer(await loginAs(prisma, server, UserRole.CUSTOMER));
    const province = await prisma.province.create({
      data: { code: 'T1', name: 'Tỉnh A', isActive: true },
    });
    zoneId = (
      await prisma.serviceZone.create({
        data: { provinceId: province.id, name: 'Trung tâm' },
      })
    ).id;
    inArea = (
      await prisma.ward.create({
        data: {
          provinceId: province.id,
          zoneId,
          code: 'W1',
          name: 'Phường Một',
          type: WardType.PHUONG,
          isActive: true,
        },
      })
    ).id;
    outOfArea = (
      await prisma.ward.create({
        data: {
          provinceId: province.id,
          code: 'W2',
          name: 'Xã Hai',
          type: WardType.XA,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const body = (wardId: number) => ({
    wardId,
    detail: 'Số 12 ngõ 34',
    contactName: 'Nguyễn Văn A',
    contactPhone: '0912345678',
  });

  async function addAddress(token = customer, extra: object = {}) {
    const res = await request(server)
      .post('/api/v1/me/addresses')
      .set(token)
      .send({ ...body(inArea), ...extra })
      .expect(201);
    return dataOf<AddressView>(res);
  }

  async function list(token = customer) {
    const res = await request(server)
      .get('/api/v1/me/addresses')
      .set(token)
      .expect(200);
    return dataOf<AddressView[]>(res);
  }

  it('chỉ CUSTOMER dùng được: không token → 401, ADMIN → 403', async () => {
    await request(server).get('/api/v1/me/addresses').expect(401);
    const admin = await loginAs(prisma, server, UserRole.ADMIN);
    await request(server)
      .get('/api/v1/me/addresses')
      .set(bearer(admin))
      .expect(403);
  });

  it('Z01: địa chỉ ngoài vùng bị chặn khi thêm và khi sửa', async () => {
    await request(server)
      .post('/api/v1/me/addresses')
      .set(customer)
      .send(body(outOfArea))
      .expect(422);
    const address = await addAddress();
    await request(server)
      .put(`/api/v1/me/addresses/${address.id}`)
      .set(customer)
      .send({ wardId: outOfArea })
      .expect(422);
    await request(server)
      .post('/api/v1/me/addresses')
      .set(customer)
      .send(body(999999))
      .expect(422);
  });

  it('phường bị tắt sau khi lưu → isServiceable = false', async () => {
    await addAddress();
    await prisma.serviceZone.update({
      where: { id: zoneId },
      data: { isActive: false },
    });
    const [address] = await list();
    expect(address).toMatchObject({
      isServiceable: false,
      ward: {
        name: 'Phường Một',
        zoneName: 'Trung tâm',
        provinceName: 'Tỉnh A',
      },
    });
  });

  it('mặc định: địa chỉ đầu tiên, đổi mặc định, xóa mặc định thì chuyển sang địa chỉ còn lại', async () => {
    const first = await addAddress();
    expect(first.isDefault).toBe(true);
    const second = await addAddress(customer, { label: 'Công ty' });
    expect(second.isDefault).toBe(false);

    await request(server)
      .patch(`/api/v1/me/addresses/${second.id}/default`)
      .set(customer)
      .expect(200);
    let all = await list();
    expect(all.map((a) => [a.id, a.isDefault])).toEqual([
      [second.id, true],
      [first.id, false],
    ]);

    await request(server)
      .delete(`/api/v1/me/addresses/${second.id}`)
      .set(customer)
      .expect(200);
    all = await list();
    expect(all.map((a) => [a.id, a.isDefault])).toEqual([[first.id, true]]);
    // Xóa mềm: bản ghi vẫn còn trong DB.
    expect(
      await prisma.address.count({ where: { id: second.id, isDeleted: true } }),
    ).toBe(1);
  });

  it('tối đa 5 địa chỉ; địa chỉ đã xóa không tính', async () => {
    const created: AddressView[] = [];
    for (let i = 0; i < 5; i++) created.push(await addAddress());
    await request(server)
      .post('/api/v1/me/addresses')
      .set(customer)
      .send(body(inArea))
      .expect(422);
    await request(server)
      .delete(`/api/v1/me/addresses/${created[4].id}`)
      .set(customer)
      .expect(200);
    await addAddress();
  });

  it('IDOR: khách khác không xem, sửa, xóa, đặt mặc định được → 404', async () => {
    const mine = await addAddress();
    const other = bearer(
      await loginAs(prisma, server, UserRole.CUSTOMER, {
        email: 'other@example.com',
        phone: '0933333333',
      }),
    );
    expect(await list(other)).toEqual([]);
    await request(server)
      .put(`/api/v1/me/addresses/${mine.id}`)
      .set(other)
      .send({ detail: 'Đổi trộm địa chỉ' })
      .expect(404);
    await request(server)
      .patch(`/api/v1/me/addresses/${mine.id}/default`)
      .set(other)
      .expect(404);
    await request(server)
      .delete(`/api/v1/me/addresses/${mine.id}`)
      .set(other)
      .expect(404);
    expect((await list())[0].detail).toBe('Số 12 ngõ 34');
  });

  it('SĐT liên hệ sai, field thừa (userId) → 400', async () => {
    await request(server)
      .post('/api/v1/me/addresses')
      .set(customer)
      .send({ ...body(inArea), contactPhone: '123' })
      .expect(400);
    await request(server)
      .post('/api/v1/me/addresses')
      .set(customer)
      .send({ ...body(inArea), userId: 1 })
      .expect(400);
  });
});
