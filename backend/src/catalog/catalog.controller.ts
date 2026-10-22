import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import type { PublicService } from './catalog.select';
import { CatalogService } from './catalog.service';

@ApiTags('services')
@Public()
@Controller('services')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách dịch vụ đang hoạt động kèm hạng mục' })
  list(): Promise<PublicService[]> {
    return this.catalog.listPublicServices();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Chi tiết dịch vụ theo slug' })
  detail(@Param('slug') slug: string): Promise<PublicService> {
    return this.catalog.getPublicService(slug);
  }
}
