import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, Matches } from 'class-validator';
import { BookingRequestDto } from './booking-item.dto';

const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';

export class QuoteBookingDto extends BookingRequestDto {
  @ApiProperty({
    example: '2026-11-02',
    description: 'Ngày theo múi giờ nghiệp vụ',
  })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  date: string;
}
