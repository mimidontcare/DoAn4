import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { mapUniqueViolation } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PUBLIC_USER_SELECT, PublicUser } from './user.select';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** C03: sửa họ tên, SĐT của chính mình; SĐT không trùng người khác. */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    if (dto.phone) {
      const owner = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
        select: { id: true },
      });
      if (owner && owner.id !== userId) {
        throw new ConflictException('Số điện thoại đã được sử dụng');
      }
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { fullName: dto.fullName, phone: dto.phone },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  /**
   * Khóa / mở khóa nhân viên hoặc khách (U02: không xóa cứng, chỉ khóa).
   * Khóa thì thu hồi mọi refresh token; access token còn hạn cũng bị chặn ngay
   * vì JwtStrategy đọc lại trạng thái từ DB ở mỗi request.
   * TODO Phase 5 (U03): không khóa nhân viên còn booking tương lai chưa được thay người.
   */
  async setStatus(userId: number, status: UserStatus): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (user.role === UserRole.ADMIN) {
      throw new UnprocessableEntityException(
        'Không khóa hoặc mở khóa tài khoản quản trị',
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status },
        select: PUBLIC_USER_SELECT,
      }),
      ...(status === UserStatus.LOCKED
        ? [
            this.prisma.refreshToken.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);
    return updated;
  }
}
