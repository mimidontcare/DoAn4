import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Đường dẫn công khai của ảnh upload, phục vụ bằng express.static (xem app.setup.ts). */
export const UPLOAD_ROUTE = '/uploads';

/** Phần cần dùng của file do multer (memory storage) đưa vào. */
export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface StoredFile {
  url: string;
}

interface ImageType {
  mime: string;
  ext: string;
  matches: (buf: Buffer) => boolean;
}

// MIME do client tự khai nên kiểm tra thêm chữ ký đầu file.
const IMAGE_TYPES: ImageType[] = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    matches: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  {
    mime: 'image/png',
    ext: 'png',
    matches: (b) =>
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

/**
 * Lưu file local. Khi deploy có thể thay phần ghi file bằng Cloudinary mà
 * không đổi nơi gọi: nơi gọi chỉ nhận về url.
 */
@Injectable()
export class StorageService {
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = resolveUploadDir(config.getOrThrow<string>('upload.dir'));
  }

  async saveImage(file: UploadedImageFile | undefined): Promise<StoredFile> {
    if (!file || file.size === 0) {
      throw new BadRequestException('Vui lòng chọn một ảnh');
    }
    const type = detectImageType(file);
    if (!type) {
      throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
    }

    // Tên file do server đặt, không dùng tên gốc của client.
    const filename = `${randomUUID()}.${type.ext}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, filename), file.buffer);
    return { url: `${UPLOAD_ROUTE}/${filename}` };
  }
}

export function detectImageType(file: UploadedImageFile): ImageType | null {
  const type = IMAGE_TYPES.find((t) => t.mime === file.mimetype);
  return type && type.matches(file.buffer) ? type : null;
}

export function resolveUploadDir(dir: string): string {
  return resolve(process.cwd(), dir);
}
