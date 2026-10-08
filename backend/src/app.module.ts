import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      // Jest tự đặt NODE_ENV=test: e2e dùng database test riêng, tránh ghi vào database dev.
      envFilePath:
        process.env.NODE_ENV === 'test' ? ['.env.test', '.env'] : ['.env'],
    }),
    // Không có ThrottlerGuard toàn cục: guard chỉ gắn ở register/login (giới hạn chặt 'auth')
    // và refresh (giới hạn chung 'default').
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.getOrThrow<number>('throttle.ttlMs'),
          limit: config.getOrThrow<number>('throttle.limit'),
        },
        {
          name: 'auth',
          ttl: config.getOrThrow<number>('auth.throttleTtlMs'),
          limit: config.getOrThrow<number>('auth.throttleLimit'),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Thứ tự đăng ký là thứ tự chạy: xác thực trước, kiểm tra role sau.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
