import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import type { PublicUser } from '../users/user.select';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';
import type { ReviewView, ServiceReviews } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('bookings/:id/review')
  @ApiBearerAuth()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Đánh giá đơn đã hoàn thành (V01)' })
  create(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewView> {
    return this.reviews.create(user.id, id, dto);
  }

  @Public()
  @Get('services/:id/reviews')
  @ApiOperation({ summary: 'Đánh giá của dịch vụ, điểm trung bình' })
  listForService(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ): Promise<ServiceReviews> {
    return this.reviews.listForService(id, query);
  }
}
