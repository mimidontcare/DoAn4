import { PartialType, PickType } from '@nestjs/swagger';
import { CreateStaffDto } from './create-staff.dto';

/** Email là định danh đăng nhập, mật khẩu do nhân viên tự đổi: không sửa ở đây. */
export class UpdateStaffDto extends PartialType(
  PickType(CreateStaffDto, ['fullName', 'phone'] as const),
) {}
