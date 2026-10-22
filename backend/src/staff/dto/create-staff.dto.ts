import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import {
  NormalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  Trim,
  VN_PHONE_REGEX,
} from '../../auth/dto/transforms';

/** U01: admin đặt mật khẩu tạm, nhân viên bị bắt đổi ở lần đăng nhập đầu. */
export class CreateStaffDto {
  @ApiProperty({ example: 'Trần Thị B' })
  @Trim()
  @IsString()
  @Length(2, 100)
  fullName: string;

  @ApiProperty({ example: 'nhanvien@example.com' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(191)
  email: string;

  @ApiProperty({ example: '0987654321' })
  @Trim()
  @Matches(VN_PHONE_REGEX, {
    message: 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0',
  })
  phone: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, description: 'Mật khẩu tạm' })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, {
    message: `Mật khẩu từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`,
  })
  password: string;
}
