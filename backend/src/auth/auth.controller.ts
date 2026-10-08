import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { AllowPendingPasswordChange } from '../common/decorators/allow-pending-password-change.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { PublicUser } from '../users/user.select';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ default: true })
  @Post('register')
  @ApiOperation({ summary: 'Khách tự đăng ký, trả luôn cặp token' })
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ default: true })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng nhập, trả access + refresh token' })
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  // Frontend gọi refresh mỗi lần tải trang để khôi phục phiên, nên chỉ áp giới hạn
  // chung 'default'; giới hạn chặt 'auth' dành cho register/login.
  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ auth: true })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đổi refresh token lấy cặp token mới' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResult> {
    return this.auth.refresh(dto.refreshToken);
  }

  @AllowPendingPasswordChange()
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thu hồi refresh token' })
  async logout(
    @CurrentUser() user: PublicUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<null> {
    await this.auth.logout(user.id, dto.refreshToken);
    return null;
  }

  @AllowPendingPasswordChange()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Người dùng hiện tại' })
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }
}
