import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { PublicUser } from '../../users/user.select';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard toàn cục: mọi route cần access token trừ route @Public().
 * Tài khoản đang bị bắt đổi mật khẩu chỉ gọi được route @AllowPendingPasswordChange().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    await super.canActivate(context);

    const user = context
      .switchToHttp()
      .getRequest<Request & { user: PublicUser }>().user;
    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      targets,
    );
    if (user.mustChangePassword && !allowPending) {
      throw new ForbiddenException('Bạn cần đổi mật khẩu trước khi tiếp tục');
    }
    return true;
  }
}
