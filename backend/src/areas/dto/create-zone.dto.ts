import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Min } from 'class-validator';
import { Trim } from '../../auth/dto/transforms';

export class CreateZoneDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  provinceId: number;

  @ApiProperty({ example: 'Khu vực trung tâm' })
  @Trim()
  @IsString()
  @Length(2, 100)
  name: string;
}
