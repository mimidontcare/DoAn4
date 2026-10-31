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

const MAX_ITEMS_PER_BOOKING = 50;

export class BookingItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  serviceItemId: number;

  @ApiProperty({
    example: 80,
    description: 'Số nguyên, trong [minQty, maxQty]',
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

/** Phần chung của báo giá và tạo đơn. */
export class BookingRequestDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  serviceId: number;

  @ApiProperty({ type: [BookingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_BOOKING)
  @ArrayUnique((item: BookingItemDto) => item?.serviceItemId, {
    message: 'Mỗi hạng mục chỉ xuất hiện một lần',
  })
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];

  @ApiProperty()
  @IsInt()
  @Min(1)
  addressId: number;
}
