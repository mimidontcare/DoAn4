import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { resolveUploadDir, UPLOAD_ROUTE } from './storage/storage.service';

export const API_PREFIX = 'api/v1';

/** Cấu hình dùng chung cho main.ts và test e2e, để test chạy đúng như production. */
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: config.getOrThrow<string>('frontendOrigin') });
  // Ảnh upload nằm ngoài tiền tố API. Helmet mặc định chặn tài nguyên khác origin
  // (Cross-Origin-Resource-Policy), nên mở riêng cho ảnh để frontend hiển thị được.
  app.use(
    UPLOAD_ROUTE,
    express.static(resolveUploadDir(config.getOrThrow<string>('upload.dir')), {
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) =>
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
}
