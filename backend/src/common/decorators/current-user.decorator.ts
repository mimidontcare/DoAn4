import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicUser } from '../../users/user.select';

/** Người dùng đã xác thực, do JwtStrategy nạp từ DB ở mỗi request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser =>
    ctx.switchToHttp().getRequest<Request & { user: PublicUser }>().user,
);
