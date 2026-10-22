import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateWardDto {
  // @IsOptional bỏ qua cả null: null nghĩa là gỡ phường khỏi khu vực.
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'null: gỡ khỏi khu vực (phường bị tắt theo)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  zoneId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
