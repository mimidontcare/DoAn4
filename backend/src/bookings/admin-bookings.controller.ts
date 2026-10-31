import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { Paginated } from '../common/dto/pagination.dto';
import type { PublicUser } from '../users/user.select';
import { AssignmentService } from './assignment.service';
import type { AvailableStaffView } from './assignment.service';
import type {
  AdminBookingDetailView,
  AdminBookingSummaryView,
} from './booking.select';
import { BookingsService } from './bookings.service';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto';
import { AssignTeamDto } from './dto/assign-team.dto';
import { ListAdminBookingsQueryDto } from './dto/list-admin-bookings-query.dto';

@ApiTags('admin / bookings')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly assignment: AssignmentService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn: lọc trạng thái, tìm theo mã' })
  list(
    @Query() query: ListAdminBookingsQueryDto,
  ): Promise<Paginated<AdminBookingSummaryView>> {
    return this.bookings.listAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn kèm khách, nhóm, lịch sử' })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminBookingDetailView> {
    return this.bookings.getForAdmin(id);
  }

  @Get(':id/available-staff')
  @ApiOperation({ summary: 'Gợi ý nhân viên rảnh cho đơn' })
  availableStaff(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AvailableStaffView[]> {
    return this.assignment.listAvailableStaff(id);
  }

  @Put(':id/assignments')
  @ApiOperation({
    summary: 'Thay cả nhóm một lần; 409 nếu trùng lịch hoặc sai version',
  })
  assign(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTeamDto,
  ): Promise<AdminBookingDetailView> {
    return this.assignment.assignTeam(user.id, id, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn, chọn lý do theo B04' })
  cancel(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminCancelBookingDto,
  ): Promise<AdminBookingDetailView> {
    return this.bookings.cancelByAdmin(user.id, id, dto);
  }
}
