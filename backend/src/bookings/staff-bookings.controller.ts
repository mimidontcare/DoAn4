import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { PublicUser } from '../users/user.select';
import type {
  StaffBookingDetailView,
  StaffBookingSummaryView,
} from './booking.select';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { DeclineBookingDto } from './dto/decline-booking.dto';
import { ProposeAdjustmentDto } from './dto/propose-adjustment.dto';
import { StaffScheduleQueryDto } from './dto/staff-schedule-query.dto';
import { StaffBookingsService } from './staff-bookings.service';

/** Thao tác của trưởng nhóm trả lại chi tiết đơn để giao diện cập nhật ngay. */
@ApiTags('staff / bookings')
@ApiBearerAuth()
@Roles(UserRole.STAFF)
@Controller('staff/bookings')
export class StaffBookingsController {
  constructor(private readonly staffBookings: StaffBookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Lịch được giao theo khoảng ngày (S01)' })
  list(
    @CurrentUser() user: PublicUser,
    @Query() query: StaffScheduleQueryDto,
  ): Promise<StaffBookingSummaryView[]> {
    return this.staffBookings.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đơn được giao' })
  get(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StaffBookingDetailView> {
    return this.staffBookings.get(user.id, id);
  }

  @Patch(':id/decline')
  @ApiOperation({ summary: 'Từ chối việc, bắt buộc lý do (S02)' })
  async decline(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeclineBookingDto,
  ): Promise<void> {
    await this.staffBookings.decline(user.id, id, dto);
  }

  @Patch(':id/check-in')
  @ApiOperation({ summary: 'Trưởng nhóm check-in → IN_PROGRESS (S03)' })
  async checkIn(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StaffBookingDetailView> {
    await this.staffBookings.checkIn(user.id, id);
    return this.staffBookings.get(user.id, id);
  }

  @Post(':id/adjustment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trưởng nhóm đề xuất điều chỉnh khối lượng (S04)' })
  async proposeAdjustment(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProposeAdjustmentDto,
  ): Promise<StaffBookingDetailView> {
    await this.staffBookings.proposeAdjustment(user.id, id, dto);
    return this.staffBookings.get(user.id, id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Trưởng nhóm hoàn thành → COMPLETED (S05)' })
  async complete(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StaffBookingDetailView> {
    await this.staffBookings.complete(user.id, id);
    return this.staffBookings.get(user.id, id);
  }

  @Patch(':id/confirm-payment')
  @ApiOperation({ summary: 'Trưởng nhóm xác nhận đã thu tiền (S06)' })
  async confirmPayment(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<StaffBookingDetailView> {
    await this.staffBookings.confirmPayment(user.id, id, dto);
    return this.staffBookings.get(user.id, id);
  }

  @Patch(':id/no-show')
  @ApiOperation({ summary: 'Trưởng nhóm báo khách vắng mặt (S07)' })
  async noShow(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StaffBookingDetailView> {
    await this.staffBookings.reportNoShow(user.id, id);
    return this.staffBookings.get(user.id, id);
  }
}
