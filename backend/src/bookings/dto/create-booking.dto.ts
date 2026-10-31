import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../auth/dto/transforms';
import { BookingRequestDto } from './booking-item.dto';

// T07: bắt buộc có múi giờ (Z hoặc ±hh:mm) để không phụ thuộc giờ máy chủ.
const WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const OFFSET_MESSAGE = 'Thời gian phải theo ISO 8601 và có múi giờ';

export class CreateBookingDto extends BookingRequestDto {
  @ApiProperty({ example: '2026-11-02T01:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: OFFSET_MESSAGE })
  @Matches(WITH_OFFSET, { message: OFFSET_MESSAGE })
  startAt: string;

  @ApiProperty({
    description:
      'Tổng tiền khách đã thấy khi báo giá; chỉ để phát hiện giá đổi (lệch → 409), không dùng làm giá',
  })
  @IsInt()
  @Min(0)
  expectedTotal: number;

  @ApiPropertyOptional({ example: 'Gọi trước khi đến' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  note?: string;
}
