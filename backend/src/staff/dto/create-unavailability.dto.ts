import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

// T07: bắt buộc có múi giờ (Z hoặc ±hh:mm) để không phụ thuộc giờ máy chủ.
const WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const OFFSET_MESSAGE = 'Thời gian phải theo ISO 8601 và có múi giờ';

export class CreateUnavailabilityDto {
  @ApiProperty({ example: '2026-11-02T01:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: OFFSET_MESSAGE })
  @Matches(WITH_OFFSET, { message: OFFSET_MESSAGE })
  startAt: string;

  @ApiProperty({ example: '2026-11-02T10:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: OFFSET_MESSAGE })
  @Matches(WITH_OFFSET, { message: OFFSET_MESSAGE })
  endAt: string;

  @ApiPropertyOptional({ example: 'Nghỉ phép' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
