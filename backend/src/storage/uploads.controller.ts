import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import {
  StorageService,
  StoredFile,
  type UploadedImageFile,
} from './storage.service';

@ApiTags('admin / uploads')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  // Giới hạn dung lượng nằm ở MulterModule (StorageModule), vượt quá → 413.
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload ảnh JPEG/PNG/WebP, trả url để gán image_url',
  })
  upload(
    @UploadedFile() file: UploadedImageFile | undefined,
  ): Promise<StoredFile> {
    return this.storage.saveImage(file);
  }
}
