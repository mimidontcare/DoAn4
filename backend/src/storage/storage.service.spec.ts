import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectImageType, StorageService } from './storage.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);

describe('detectImageType', () => {
  it('MIME và chữ ký khớp → nhận', () => {
    expect(
      detectImageType({ buffer: PNG, mimetype: 'image/png', size: 9 })?.ext,
    ).toBe('png');
    expect(
      detectImageType({ buffer: JPEG, mimetype: 'image/jpeg', size: 5 })?.ext,
    ).toBe('jpg');
  });

  it('khai MIME ảnh nhưng nội dung không phải ảnh → từ chối', () => {
    const html = Buffer.from('<html><script>');
    expect(
      detectImageType({ buffer: html, mimetype: 'image/png', size: 14 }),
    ).toBeNull();
  });

  it('MIME không nằm trong danh sách → từ chối', () => {
    expect(
      detectImageType({ buffer: PNG, mimetype: 'image/svg+xml', size: 9 }),
    ).toBeNull();
  });
});

describe('StorageService', () => {
  let dir: string;
  let service: StorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'uploads-'));
    const config = {
      getOrThrow: () => dir,
    } as unknown as ConfigService;
    service = new StorageService(config);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lưu với tên do server đặt, trả url /uploads/<tên>', async () => {
    const { url } = await service.saveImage({
      buffer: PNG,
      mimetype: 'image/png',
      size: PNG.length,
    });
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(await readdir(dir)).toEqual([url.split('/').pop()]);
  });

  it('thiếu file hoặc sai định dạng → 400', async () => {
    await expect(service.saveImage(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.saveImage({
        buffer: Buffer.from('abc'),
        mimetype: 'image/png',
        size: 3,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
