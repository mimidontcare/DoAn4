import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PricingUnit } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Trim } from '../../auth/dto/transforms';
import { MAX_MONEY_VND } from './create-service.dto';

export const MAX_ITEM_QTY = 100_000;
export const MAX_MINUTES_PER_UNIT = 24 * 60;

/** Ràng buộc giữa các field (min_qty ≤ max_qty, is_required) kiểm tra ở CatalogService. */
export class CreateServiceItemDto {
  @ApiProperty({ example: 'Sofa 3 chỗ' })
  @Trim()
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ enum: PricingUnit })
  @IsEnum(PricingUnit)
  unit: PricingUnit;

  @ApiProperty({ example: 350000, description: 'Đơn giá (VND)' })
  @IsInt({ message: 'Tiền phải là số nguyên VND' })
  @Min(0)
  @Max(MAX_MONEY_VND)
  unitPrice: number;

  @ApiProperty({ example: 90, description: 'Phút công cho một đơn vị' })
  @IsInt()
  @Min(0)
  @Max(MAX_MINUTES_PER_UNIT)
  minutesPerUnit: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Max(MAX_ITEM_QTY)
  minQty: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(MAX_ITEM_QTY)
  maxQty: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}
