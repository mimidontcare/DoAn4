import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, Matches, Min } from 'class-validator';

// T07: bắt buộc có múi giờ (Z hoặc ±hh:mm) để không phụ thuộc giờ máy chủ.
const WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const OFFSET_MESSAGE = 'Thời gian phải theo ISO 8601 và có múi giờ';

/** R01: chỉ đổi thời gian. */
export class RescheduleBookingDto {
  @ApiProperty({ example: '2026-11-05T02:00:00.000Z' })
  @IsISO8601({ strict: true }, { message: OFFSET_MESSAGE })
  @Matches(WITH_OFFSET, { message: OFFSET_MESSAGE })
  startAt: string;

  @ApiProperty({
    description:
      'Tổng tiền khách đã thấy cho giờ mới (phụ phí theo ngày); lệch → 409, không dùng làm giá',
  })
  @IsInt()
  @Min(0)
  expectedTotal: number;
}
