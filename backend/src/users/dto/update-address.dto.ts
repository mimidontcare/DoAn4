import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAddressDto } from './create-address.dto';

/** Đổi mặc định dùng PATCH /me/addresses/:id/default. */
export class UpdateAddressDto extends PartialType(
  OmitType(CreateAddressDto, ['isDefault'] as const),
) {}
