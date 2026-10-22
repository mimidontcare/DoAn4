import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [
    // Không khai báo dest/storage: multer giữ file trong bộ nhớ (file.buffer),
    // StorageService kiểm tra xong mới ghi ra đĩa.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: config.getOrThrow<number>('upload.maxBytes'),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [UploadsController],
  providers: [StorageService],
})
export class StorageModule {}
