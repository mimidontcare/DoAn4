import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

const MAX_TEAM_SIZE = 50;

export class AssignTeamDto {
  @ApiProperty({ type: [Number], description: 'Đúng staffCount người' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TEAM_SIZE)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  staffIds: number[];

  @ApiProperty({ description: 'Phải thuộc staffIds' })
  @IsInt()
  @Min(1)
  leaderId: number;

  @ApiProperty({
    description:
      'Version admin đang xem; đơn đã đổi thì trả 409 thay vì ghi đè',
  })
  @IsInt()
  @Min(0)
  version: number;
}
