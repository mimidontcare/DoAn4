import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { QueryBoolean } from '../../common/dto/pagination.dto';
import { Trim } from '../../auth/dto/transforms';
import { ListBookingsQueryDto } from './list-bookings-query.dto';

export class ListAdminBookingsQueryDto extends ListBookingsQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã đơn' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(20)
  q?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'A06: đơn đã xác nhận, quá giờ bắt đầu mà chưa check-in',
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  overdueCheckIn?: boolean;
}
