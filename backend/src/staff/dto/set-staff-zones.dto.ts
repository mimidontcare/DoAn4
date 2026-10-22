import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class SetStaffZonesDto {
  @ApiProperty({
    type: [Number],
    description: 'Thay toàn bộ khu vực của nhân viên; mảng rỗng là gỡ hết',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  zoneIds: number[];
}
