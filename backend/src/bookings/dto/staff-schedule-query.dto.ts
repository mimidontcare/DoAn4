import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';

const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày theo múi giờ nghiệp vụ, gồm cả ngày cuối. */
export class StaffScheduleQueryDto {
  @ApiProperty({ example: '2026-11-02' })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  from: string;

  @ApiProperty({ example: '2026-11-08' })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  to: string;
}
