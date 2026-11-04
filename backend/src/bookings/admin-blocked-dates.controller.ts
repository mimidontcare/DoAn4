import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { PublicUser } from '../users/user.select';
import { BlockedDatesService } from './blocked-dates.service';
import type { BlockedDateView } from './blocked-dates.service';
import { CreateBlockedDateDto } from './dto/create-blocked-date.dto';

@ApiTags('admin / blocked dates')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/blocked-dates')
export class AdminBlockedDatesController {
  constructor(private readonly blockedDates: BlockedDatesService) {}

  @Get()
  @ApiOperation({ summary: 'Ngày không phục vụ từ hôm nay (T08)' })
  list(): Promise<BlockedDateView[]> {
    return this.blockedDates.listUpcoming();
  }

  @Post()
  @ApiOperation({
    summary: 'Thêm ngày không phục vụ; trả số đơn đã có trong ngày đó',
  })
  create(
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateBlockedDateDto,
  ): Promise<BlockedDateView & { affectedBookings: number }> {
    return this.blockedDates.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bỏ ngày không phục vụ' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.blockedDates.remove(id);
  }
}
