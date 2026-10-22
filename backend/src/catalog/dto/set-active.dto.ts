import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** U02: dịch vụ và hạng mục không xóa cứng, chỉ bật/tắt. */
export class SetActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;
}
