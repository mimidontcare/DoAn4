import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim, VN_PHONE_REGEX } from '../../auth/dto/transforms';

export class CreateAddressDto {
  @ApiProperty({ description: 'Phường/xã, phải đang trong vùng phục vụ (Z01)' })
  @IsInt()
  @Min(1)
  wardId: number;

  @ApiProperty({ example: 'Số 12, ngõ 34 Phố Huế' })
  @Trim()
  @IsString()
  @Length(5, 255)
  detail: string;

  @ApiPropertyOptional({ example: 'Nhà riêng' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  label?: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @Trim()
  @IsString()
  @Length(2, 100)
  contactName: string;

  @ApiProperty({ example: '0912345678' })
  @Trim()
  @Matches(VN_PHONE_REGEX, {
    message: 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0',
  })
  contactPhone: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ đầu tiên luôn là mặc định',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
