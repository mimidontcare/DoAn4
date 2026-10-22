import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

/** Không đổi tỉnh của khu vực; khu vực không xóa, chỉ tắt. */
export class UpdateZoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Tắt khu vực thì mọi phường trong đó ngừng nhận đặt',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
