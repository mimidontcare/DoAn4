import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RespondAdjustmentDto {
  @ApiProperty({
    description: 'true: chấp nhận đề xuất; false: giữ khối lượng đã đặt',
  })
  @IsBoolean()
  accept: boolean;
}
