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
import type { Paginated } from '../common/dto/pagination.dto';
import type { PublicUser } from '../users/user.select';
import type { BookingDetailView, BookingSummaryView } from './booking.select';
import { AdjustmentService } from './adjustment.service';
import { BookingsService } from './bookings.service';
import { RescheduleService } from './reschedule.service';
import type { RescheduleOptions } from './reschedule.service';
import type { QuoteResult } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';
import { RescheduleOptionsQueryDto } from './dto/reschedule-options-query.dto';
import { RespondAdjustmentDto } from './dto/respond-adjustment.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller()
export class CustomerBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly adjustment: AdjustmentService,
    private readonly reschedule: RescheduleService,
  ) {}

  @Post('bookings/quote')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Báo giá và các giờ bắt đầu còn đủ người trong ngày',
  })
  quote(
    @CurrentUser() user: PublicUser,
    @Body() dto: QuoteBookingDto,
  ): Promise<QuoteResult> {
    return this.bookings.quote(user.id, dto);
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Tạo booking PENDING; giá do server tính lại' })
  create(
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDetailView> {
    return this.bookings.create(user.id, dto);
  }

  @Get('me/bookings')
  @ApiOperation({ summary: 'Đơn của tôi, lọc theo trạng thái' })
  list(
    @CurrentUser() user: PublicUser,
    @Query() query: ListBookingsQueryDto,
  ): Promise<Paginated<BookingSummaryView>> {
    return this.bookings.listOwned(user.id, query);
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Chi tiết đơn của tôi kèm lịch sử' })
  get(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BookingDetailView> {
    return this.bookings.getOwned(user.id, id);
  }

  @Patch('bookings/:id/cancel')
  @ApiOperation({ summary: 'Hủy đơn của tôi (C01–C03)' })
  cancel(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelBookingDto,
  ): Promise<BookingDetailView> {
    return this.bookings.cancelOwned(user.id, id, dto);
  }

  @Patch('bookings/:id/adjustment')
  @ApiOperation({ summary: 'Chấp nhận hoặc từ chối đề xuất điều chỉnh (C10)' })
  respondAdjustment(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondAdjustmentDto,
  ): Promise<BookingDetailView> {
    return this.adjustment.respondAsCustomer(user.id, id, dto.accept);
  }

  @Get('bookings/:id/reschedule-options')
  @ApiOperation({
    summary: 'Giờ trống và giá mới khi đổi lịch sang ngày khác (R01)',
  })
  rescheduleOptions(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: RescheduleOptionsQueryDto,
  ): Promise<RescheduleOptions> {
    return this.reschedule.options(user.id, id, query.date);
  }

  @Patch('bookings/:id/reschedule')
  @ApiOperation({
    summary: 'Đổi lịch (R01): nhóm cũ còn rảnh thì giữ, không thì về PENDING',
  })
  rescheduleBooking(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleBookingDto,
  ): Promise<BookingDetailView> {
    return this.reschedule.reschedule(user.id, id, dto);
  }
}
