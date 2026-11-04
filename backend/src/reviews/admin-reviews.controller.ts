import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import type { Paginated } from '../common/dto/pagination.dto';
import { ListAdminReviewsQueryDto } from './dto/list-admin-reviews-query.dto';
import { ReviewsService } from './reviews.service';
import type { AdminReviewView } from './reviews.service';

@ApiTags('admin / reviews')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đánh giá, lọc theo trạng thái ẩn' })
  list(
    @Query() query: ListAdminReviewsQueryDto,
  ): Promise<Paginated<AdminReviewView>> {
    return this.reviews.listForAdmin(query);
  }

  @Patch(':id/hide')
  @ApiOperation({ summary: 'Ẩn đánh giá (V03)' })
  hide(@Param('id', ParseIntPipe) id: number): Promise<AdminReviewView> {
    return this.reviews.setHidden(id, true);
  }

  @Patch(':id/unhide')
  @ApiOperation({ summary: 'Hiện lại đánh giá' })
  unhide(@Param('id', ParseIntPipe) id: number): Promise<AdminReviewView> {
    return this.reviews.setHidden(id, false);
  }
}
