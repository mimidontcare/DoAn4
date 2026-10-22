import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AreasService } from '../areas/areas.service';
import { PrismaService } from '../prisma/prisma.service';
import { ADDRESS_SELECT, AddressView, toAddressView } from './address.select';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/**
 * C04: địa chỉ của khách. Mọi truy vấn lọc theo userId của người đang đăng nhập
 * (chống IDOR): địa chỉ của người khác coi như không tồn tại → 404.
 */
@Injectable()
export class AddressesService {
  private readonly maxAddresses: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly areas: AreasService,
    config: ConfigService,
  ) {
    this.maxAddresses = config.getOrThrow<number>('customer.maxAddresses');
  }

  async list(userId: number): Promise<AddressView[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId, isDeleted: false },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: ADDRESS_SELECT,
    });
    return rows.map(toAddressView);
  }

  async create(userId: number, dto: CreateAddressDto): Promise<AddressView> {
    const count = await this.prisma.address.count({
      where: { userId, isDeleted: false },
    });
    if (count >= this.maxAddresses) {
      throw new UnprocessableEntityException(
        `Mỗi tài khoản lưu tối đa ${this.maxAddresses} địa chỉ`,
      );
    }
    await this.areas.assertWardServiceable(dto.wardId);

    // Địa chỉ đầu tiên luôn là mặc định.
    const isDefault = count === 0 || dto.isDefault === true;
    const row = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: { ...dto, userId, isDefault },
        select: ADDRESS_SELECT,
      });
    });
    return toAddressView(row);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateAddressDto,
  ): Promise<AddressView> {
    await this.findOwnedOrThrow(userId, id);
    if (dto.wardId !== undefined) {
      await this.areas.assertWardServiceable(dto.wardId);
    }
    const row = await this.prisma.address.update({
      where: { id },
      data: dto,
      select: ADDRESS_SELECT,
    });
    return toAddressView(row);
  }

  /** Chỉ một địa chỉ mặc định mỗi khách. */
  async setDefault(userId: number, id: number): Promise<AddressView> {
    await this.findOwnedOrThrow(userId, id);
    const [, row] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id },
        data: { isDefault: true },
        select: ADDRESS_SELECT,
      }),
    ]);
    return toAddressView(row);
  }

  /** Xóa mềm; xóa địa chỉ mặc định thì địa chỉ cũ nhất còn lại thành mặc định. */
  async remove(userId: number, id: number): Promise<void> {
    const address = await this.findOwnedOrThrow(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id },
        data: { isDeleted: true, isDefault: false },
      });
      if (!address.isDefault) return;
      const next = await tx.address.findFirst({
        where: { userId, isDeleted: false },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (next) {
        await tx.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    });
  }

  private async findOwnedOrThrow(userId: number, id: number) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId, isDeleted: false },
      select: { id: true, isDefault: true },
    });
    if (!address) {
      throw new NotFoundException('Không tìm thấy địa chỉ');
    }
    return address;
  }
}
