import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import type { ServiceAreas } from './areas.select';
import { AreasService } from './areas.service';

@ApiTags('service-areas')
@Public()
@Controller('service-areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Phường/xã đang phục vụ của tỉnh đang hoạt động, nhóm theo khu vực',
  })
  get(): Promise<ServiceAreas> {
    return this.areas.getServiceAreas();
  }
}
