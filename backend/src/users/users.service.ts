import { ConflictException, Injectable } from '@nestjs/common';
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
}
