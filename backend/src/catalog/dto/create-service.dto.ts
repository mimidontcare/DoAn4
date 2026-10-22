import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../auth/dto/transforms';
import { SLUG_REGEX } from '../../common/utils/slug';

// Giới hạn chống nhập nhầm, vẫn nằm trong INT của MySQL; không phải ngưỡng nghiệp vụ.
export const MAX_MONEY_VND = 1_000_000_000;

export class CreateServiceDto {
  @ApiProperty({ example: 'Tổng vệ sinh nhà đang ở' })
  @Trim()
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiPropertyOptional({
    example: 'tong-ve-sinh-nha-dang-o',
    description: 'Bỏ trống thì tự sinh từ tên',
  })
  @IsOptional()
  @Trim()
  @Matches(SLUG_REGEX, {
    message: 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
  })
  @MaxLength(160)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '/uploads/abc.webp' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiProperty({ example: 500000, description: 'Mức tối thiểu (VND, P04)' })
  @IsInt({ message: 'Tiền phải là số nguyên VND' })
  @Min(0)
  @Max(MAX_MONEY_VND)
  minCharge: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}
