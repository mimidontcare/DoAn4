import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CancelReason } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

// CUSTOMER_NO_SHOW do trưởng nhóm báo (S07) vì kèm tính hủy muộn.
const ADMIN_CANCEL_REASONS = [
  CancelReason.CUSTOMER_REQUEST,
  CancelReason.NO_STAFF_AVAILABLE,
  CancelReason.ADMIN_DECISION,
  CancelReason.OTHER,
];

export class AdminCancelBookingDto {
  @ApiProperty({ enum: ADMIN_CANCEL_REASONS })
  @IsIn(ADMIN_CANCEL_REASONS)
  reason: CancelReason;

  @ApiPropertyOptional({ example: 'Khu vực không còn nhân viên rảnh' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}
