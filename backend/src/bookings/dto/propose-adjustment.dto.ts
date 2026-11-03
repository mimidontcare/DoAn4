import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_ITEMS = 50;

export class ProposedItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  serviceItemId: number;

  @ApiProperty({ description: '0 là bỏ hạng mục (nếu không bắt buộc)' })
  @IsInt()
  @Min(0)
  proposedQuantity: number;
}

/** A02: chỉ nhập khối lượng, không nhập giá. Hạng mục không gửi giữ nguyên. */
export class ProposeAdjustmentDto {
  @ApiProperty({ type: [ProposedItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS)
  @ArrayUnique((item: ProposedItemDto) => item?.serviceItemId, {
    message: 'Mỗi hạng mục chỉ xuất hiện một lần',
  })
  @ValidateNested({ each: true })
  @Type(() => ProposedItemDto)
  items: ProposedItemDto[];
}
