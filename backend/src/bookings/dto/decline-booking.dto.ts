import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

/** S02: từ chối việc bắt buộc có lý do. */
export class DeclineBookingDto {
  @ApiProperty({ example: 'Ốm đột xuất' })
  @Trim()
  @IsString()
  @Length(3, 255)
  reason: string;
}
