import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

/** Khách hủy luôn ghi lý do CUSTOMER_REQUEST (B04), chỉ nhập ghi chú. */
export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Đổi kế hoạch' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}
