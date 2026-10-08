import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_USER_SELECT, PublicUser } from '../users/user.select';

export interface JwtPayload {
  sub: number;
  role: string;
}

/**
 * Xác thực access token rồi nạp user từ DB ở mỗi request, để tài khoản bị khóa
 * hoặc vừa đổi role mất quyền ngay, không phải chờ token hết hạn.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.jwtAccessSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException('Tài khoản đã bị khóa');
    }
    return user;
  }
}
