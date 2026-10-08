import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { Trim, VN_PHONE_REGEX } from '../../auth/dto/transforms';

/** Email là định danh đăng nhập nên không đổi ở đây. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @Trim()
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @Trim()
  @Matches(VN_PHONE_REGEX, {
    message: 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0',
  })
  phone?: string;
}
