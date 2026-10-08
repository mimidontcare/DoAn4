import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_USER_SELECT, PublicUser } from '../users/user.select';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt.strategy';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng';
const INVALID_REFRESH_TOKEN = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly refreshTokenTtlDays: number;
  // So mật khẩu với hash giả khi email không tồn tại, để thời gian phản hồi
  // không tiết lộ email nào đã đăng ký.
  private readonly dummyHash: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.bcryptRounds = config.getOrThrow<number>('auth.bcryptRounds');
    this.refreshTokenTtlDays = config.getOrThrow<number>(
      'auth.refreshTokenTtlDays',
    );
    this.dummyHash = bcrypt.hashSync('dummy-password', this.bcryptRounds);
  }

  /** C01: khách tự đăng ký; email và SĐT không trùng. */
  async register(dto: RegisterDto): Promise<AuthResult> {
    await this.assertEmailAndPhoneAvailable(dto.email, dto.phone);

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    let user: PublicUser;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          role: UserRole.CUSTOMER,
        },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      // Hai request đăng ký cùng lúc vượt qua bước kiểm tra trên.
      throw mapUniqueViolation(error);
    }
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const found = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...PUBLIC_USER_SELECT, passwordHash: true },
    });
    const passwordOk = await bcrypt.compare(
      dto.password,
      found?.passwordHash ?? this.dummyHash,
    );
    if (!found || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const user = omitPasswordHash(found);
    assertActive(user);
    return this.issueTokens(user);
  }

  /** Đổi refresh token lấy cặp token mới; token cũ bị thu hồi (rotation). */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: PUBLIC_USER_SELECT },
      },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }
    assertActive(stored.user);

    // Điều kiện revokedAt = null: hai request refresh cùng một token chỉ một cái thành công.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }
    return this.issueTokens(stored.user);
  }

  /** Thu hồi refresh token của chính người dùng; gọi lại nhiều lần vẫn thành công. */
  async logout(userId: number, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Đổi mật khẩu, bỏ cờ must_change_password (U01), thu hồi mọi phiên cũ
   * rồi cấp cặp token mới cho phiên hiện tại.
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<AuthResult> {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    // 422 thay vì 401: sai mật khẩu cũ không phải lỗi phiên đăng nhập.
    if (!(await bcrypt.compare(dto.currentPassword, current.passwordHash))) {
      throw new UnprocessableEntityException('Mật khẩu hiện tại không đúng');
    }
    if (await bcrypt.compare(dto.newPassword, current.passwordHash)) {
      throw new UnprocessableEntityException(
        'Mật khẩu mới phải khác mật khẩu hiện tại',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
        select: PUBLIC_USER_SELECT,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.issueTokens(user);
  }

  private async assertEmailAndPhoneAvailable(email: string, phone: string) {
    const existing = await this.prisma.user.findMany({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (existing.some((u) => u.email === email)) {
      throw new ConflictException('Email đã được sử dụng');
    }
    if (existing.some((u) => u.phone === phone)) {
      throw new ConflictException('Số điện thoại đã được sử dụng');
    }
  }

  private async issueTokens(user: PublicUser): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    // Refresh token là chuỗi ngẫu nhiên; DB chỉ lưu hash để thu hồi được.
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTokenTtlDays * DAY_MS),
      },
    });
    return { accessToken, refreshToken, user };
  }
}

/** Token đủ ngẫu nhiên (256 bit) nên SHA-256 là đủ, và tra cứu được theo hash. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function omitPasswordHash(
  user: PublicUser & { passwordHash: string },
): PublicUser {
  const publicUser: Partial<typeof user> = { ...user };
  delete publicUser.passwordHash;
  return publicUser as PublicUser;
}

function assertActive(user: PublicUser) {
  if (user.status === UserStatus.LOCKED) {
    throw new ForbiddenException('Tài khoản đã bị khóa');
  }
}

/** Lỗi unique của Prisma (P2002) → 409 kèm field bị trùng. */
export function mapUniqueViolation(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = JSON.stringify(error.meta?.target ?? '');
    if (target.includes('phone')) {
      return new ConflictException('Số điện thoại đã được sử dụng');
    }
    if (target.includes('email')) {
      return new ConflictException('Email đã được sử dụng');
    }
    return new ConflictException('Dữ liệu đã tồn tại');
  }
  return error;
}
