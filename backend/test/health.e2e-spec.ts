import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ApiResponse } from '../src/common/interceptors/response.interceptor';
import type { HealthResult } from '../src/health/health.service';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health trả db up theo format thống nhất', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = res.body as ApiResponse<HealthResult>;
    expect(body).toMatchObject({
      success: true,
      message: 'OK',
      errors: null,
      data: { status: 'ok', db: 'up' },
    });
    expect(typeof body.data?.time).toBe('string');
  });

  it('GET /api/v1/health trả 503 và db down khi mất kết nối DB', async () => {
    const prisma = app.get(PrismaService);
    const spy = jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('connection lost'));

    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);

    const body = res.body as ApiResponse<HealthResult>;
    expect(body.success).toBe(false);
    expect(body.data).toMatchObject({ status: 'error', db: 'down' });
    spy.mockRestore();
  });

  it('route không tồn tại trả 404 qua exception filter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/khong-ton-tai')
      .expect(404);

    const body = res.body as ApiResponse<null>;
    expect(body).toMatchObject({ success: false, data: null });
    expect(typeof body.message).toBe('string');
  });

  it('ngoài prefix /api/v1 cũng 404', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('có header bảo mật của helmet', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
