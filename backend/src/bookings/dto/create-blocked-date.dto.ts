import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

const DATE_MESSAGE = 'Ngày phải có dạng YYYY-MM-DD';

export class CreateBlockedDateDto {
  @ApiProperty({
    example: '2027-02-06',
    description: 'Ngày theo múi giờ nghiệp vụ',
  })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  date: string;

  @ApiPropertyOptional({ example: 'Nghỉ Tết' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
