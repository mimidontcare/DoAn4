import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  PaginationQueryDto,
  QueryBoolean,
} from '../../common/dto/pagination.dto';

export class ListAdminReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo trạng thái ẩn (V03)' })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  hidden?: boolean;
}
