import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import type { DashboardView } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('admin / dashboard')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Thống kê rút gọn: đơn theo trạng thái, doanh thu tháng, điểm trung bình',
  })
  summary(@Query() query: DashboardQueryDto): Promise<DashboardView> {
    return this.dashboard.summary(query.month);
  }
}
