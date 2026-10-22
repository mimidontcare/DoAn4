import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  AdminService,
  AdminServiceItem,
  PublicService,
} from '../src/catalog/catalog.select';
import { PrismaService } from '../src/prisma/prisma.service';
import type { StoredFile } from '../src/storage/storage.service';
import {
  bearer,
  createTestApp,
  dataOf,
  loginAs,
  resetDatabase,
} from './e2e-helpers';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let server: App;
  let admin: Record<string, string>;

  beforeAll(async () => {
    ({ app, prisma, server } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = bearer(await loginAs(prisma, server, UserRole.ADMIN));
  });

  afterAll(async () => {
    await app.close();
  });

  const serviceBody = {
    name: 'Vệ sinh sofa, nệm, rèm',
    description: 'Giặt hút tại nhà',
    minCharge: 300000,
  };
  const itemBody = {
    name: 'Sofa 3 chỗ',
    unit: 'UNIT',
    unitPrice: 350000,
    minutesPerUnit: 90,
    minQty: 0,
    maxQty: 5,
  };

  async function createService(body: object = serviceBody) {
    const res = await request(server)
      .post('/api/v1/admin/services')
      .set(admin)
      .send(body)
      .expect(201);
    return dataOf<AdminService>(res);
  }

  describe('Phân quyền', () => {
    it('admin API: không token → 401, CUSTOMER → 403', async () => {
      await request(server).get('/api/v1/admin/services').expect(401);
      const customer = await loginAs(prisma, server, UserRole.CUSTOMER);
      await request(server)
        .post('/api/v1/admin/services')
        .set(bearer(customer))
        .send(serviceBody)
        .expect(403);
    });

    it('public API không cần đăng nhập', async () => {
      await request(server).get('/api/v1/services').expect(200);
    });
  });

  describe('Dịch vụ', () => {
    it('tạo dịch vụ: slug tự sinh; slug trùng → 409', async () => {
      const created = await createService();
      expect(created).toMatchObject({
        slug: 've-sinh-sofa-nem-rem',
        minCharge: 300000,
        isActive: true,
        items: [],
      });
      await request(server)
        .post('/api/v1/admin/services')
        .set(admin)
        .send({ ...serviceBody, name: 'Tên khác', slug: created.slug })
        .expect(409);
    });

    it('tiền số thực, âm, field thừa, slug sai định dạng → 400', async () => {
      for (const body of [
        { ...serviceBody, minCharge: 1000.5 },
        { ...serviceBody, minCharge: -1 },
        { ...serviceBody, isActive: false },
        { ...serviceBody, slug: 'Có Dấu' },
      ]) {
        await request(server)
          .post('/api/v1/admin/services')
          .set(admin)
          .send(body)
          .expect(400);
      }
    });

    it('sửa dịch vụ; id không tồn tại → 404', async () => {
      const { id } = await createService();
      const res = await request(server)
        .put(`/api/v1/admin/services/${id}`)
        .set(admin)
        .send({ minCharge: 400000, imageUrl: '' })
        .expect(200);
      expect(dataOf<AdminService>(res)).toMatchObject({
        minCharge: 400000,
        imageUrl: null,
      });
      await request(server)
        .put('/api/v1/admin/services/999999')
        .set(admin)
        .send({ minCharge: 1 })
        .expect(404);
    });

    it('tắt dịch vụ → biến mất khỏi public, admin vẫn thấy; không có DELETE', async () => {
      const { id, slug } = await createService();
      await request(server).get(`/api/v1/services/${slug}`).expect(200);

      await request(server)
        .patch(`/api/v1/admin/services/${id}/status`)
        .set(admin)
        .send({ isActive: false })
        .expect(200);
      await request(server).get(`/api/v1/services/${slug}`).expect(404);
      const list = await request(server).get('/api/v1/services').expect(200);
      expect(dataOf<PublicService[]>(list)).toHaveLength(0);
      await request(server)
        .get(`/api/v1/admin/services/${id}`)
        .set(admin)
        .expect(200);

      await request(server)
        .delete(`/api/v1/admin/services/${id}`)
        .set(admin)
        .expect(404);
    });
  });

  describe('Hạng mục giá (Q01)', () => {
    it('min > max hoặc bắt buộc mà min = 0 → 422', async () => {
      const { id } = await createService();
      await request(server)
        .post(`/api/v1/admin/services/${id}/items`)
        .set(admin)
        .send({ ...itemBody, minQty: 6, maxQty: 5 })
        .expect(422);
      await request(server)
        .post(`/api/v1/admin/services/${id}/items`)
        .set(admin)
        .send({ ...itemBody, isRequired: true })
        .expect(422);
    });

    it('đơn vị sai, giá số thực → 400', async () => {
      const { id } = await createService();
      await request(server)
        .post(`/api/v1/admin/services/${id}/items`)
        .set(admin)
        .send({ ...itemBody, unit: 'HOUR' })
        .expect(400);
      await request(server)
        .post(`/api/v1/admin/services/${id}/items`)
        .set(admin)
        .send({ ...itemBody, unitPrice: 99.9 })
        .expect(400);
    });

    it('thêm, sửa, tắt hạng mục; public chỉ thấy hạng mục đang bật', async () => {
      const service = await createService();
      const base = `/api/v1/admin/services/${service.id}/items`;
      const sofa = dataOf<AdminServiceItem>(
        await request(server).post(base).set(admin).send(itemBody).expect(201),
      );
      const nem = dataOf<AdminServiceItem>(
        await request(server)
          .post(base)
          .set(admin)
          .send({ ...itemBody, name: 'Nệm 1m6', unitPrice: 300000 })
          .expect(201),
      );

      const updated = await request(server)
        .put(`${base}/${sofa.id}`)
        .set(admin)
        .send({ unitPrice: 380000 })
        .expect(200);
      expect(dataOf<AdminServiceItem>(updated).unitPrice).toBe(380000);
      await request(server)
        .put(`${base}/${sofa.id}`)
        .set(admin)
        .send({ minQty: 3 })
        .expect(200);
      // Chỉ gửi maxQty nhỏ hơn minQty đang lưu cũng bị chặn.
      await request(server)
        .put(`${base}/${sofa.id}`)
        .set(admin)
        .send({ maxQty: 2 })
        .expect(422);

      await request(server)
        .patch(`${base}/${nem.id}/status`)
        .set(admin)
        .send({ isActive: false })
        .expect(200);

      const detail = dataOf<PublicService>(
        await request(server)
          .get(`/api/v1/services/${service.slug}`)
          .expect(200),
      );
      expect(detail.items.map((i) => i.name)).toEqual(['Sofa 3 chỗ']);
    });

    it('hạng mục của dịch vụ khác → 404', async () => {
      const a = await createService();
      const b = await createService({ ...serviceBody, name: 'Vệ sinh kính' });
      const item = dataOf<AdminServiceItem>(
        await request(server)
          .post(`/api/v1/admin/services/${a.id}/items`)
          .set(admin)
          .send(itemBody)
          .expect(201),
      );
      await request(server)
        .put(`/api/v1/admin/services/${b.id}/items/${item.id}`)
        .set(admin)
        .send({ unitPrice: 1 })
        .expect(404);
    });
  });

  describe('Upload ảnh', () => {
    it('ảnh hợp lệ → url xem được từ origin khác; file giả → 400', async () => {
      const res = await request(server)
        .post('/api/v1/admin/uploads')
        .set(admin)
        .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
        .expect(201);
      const { url } = dataOf<StoredFile>(res);
      expect(url).toMatch(/^\/uploads\/.+\.png$/);

      try {
        const file = await request(server).get(url).expect(200);
        expect(file.headers['cross-origin-resource-policy']).toBe(
          'cross-origin',
        );
        expect(await readFile(join(process.cwd(), url.slice(1)))).toEqual(PNG);
      } finally {
        await rm(join(process.cwd(), url.slice(1)), { force: true });
      }

      await request(server)
        .post('/api/v1/admin/uploads')
        .set(admin)
        .attach('file', Buffer.from('<svg/>'), {
          filename: 'a.png',
          contentType: 'image/png',
        })
        .expect(400);
      await request(server)
        .post('/api/v1/admin/uploads')
        .set(admin)
        .expect(400);
    });

    it('vượt dung lượng → 413', async () => {
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
      await request(server)
        .post('/api/v1/admin/uploads')
        .set(admin)
        .attach('file', big, { filename: 'a.png', contentType: 'image/png' })
        .expect(413);
    });
  });
});
