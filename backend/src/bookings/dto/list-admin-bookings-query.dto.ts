import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../auth/dto/transforms';
import { ListBookingsQueryDto } from './list-bookings-query.dto';

export class ListAdminBookingsQueryDto extends ListBookingsQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã đơn' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  q?: string;
}
