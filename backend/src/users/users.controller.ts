import { Body, Controller, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthResult, AuthService } from '../auth/auth.service';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { AllowPendingPasswordChange } from '../common/decorators/allow-pending-password-change.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { PublicUser } from './user.select';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Put()
  @ApiOperation({ summary: 'Sửa hồ sơ (họ tên, SĐT)' })
  updateProfile(
    @CurrentUser() user: PublicUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return this.users.updateProfile(user.id, dto);
  }

  @AllowPendingPasswordChange()
  @Put('password')
  @ApiOperation({
    summary: 'Đổi mật khẩu; thu hồi mọi phiên cũ và trả cặp token mới',
  })
  changePassword(
    @CurrentUser() user: PublicUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<AuthResult> {
    return this.auth.changePassword(user.id, dto);
  }
}
