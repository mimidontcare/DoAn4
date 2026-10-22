import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_ITEM_SELECT,
  ADMIN_SERVICE_SELECT,
  ADMIN_SERVICE_SUMMARY_SELECT,
  AdminService,
  AdminServiceItem,
  AdminServiceSummary,
  PUBLIC_SERVICE_SELECT,
  PublicService,
  SERVICE_ORDER,
} from './catalog.select';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceItemDto } from './dto/update-service-item.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const SERVICE_NOT_FOUND = 'Không tìm thấy dịch vụ';
const ITEM_NOT_FOUND = 'Không tìm thấy hạng mục';
const SLUG_TAKEN = 'Slug đã được sử dụng';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Public (C05) ----------

  listPublicServices(): Promise<PublicService[]> {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: SERVICE_ORDER,
      select: PUBLIC_SERVICE_SELECT,
    });
  }

  async getPublicService(slug: string): Promise<PublicService> {
    const service = await this.prisma.service.findFirst({
      where: { slug, isActive: true },
      select: PUBLIC_SERVICE_SELECT,
    });
    if (!service) {
      throw new NotFoundException(SERVICE_NOT_FOUND);
    }
    return service;
  }

  // ---------- Admin: dịch vụ (A01) ----------

  listServices(): Promise<AdminServiceSummary[]> {
    return this.prisma.service.findMany({
      orderBy: SERVICE_ORDER,
      select: ADMIN_SERVICE_SUMMARY_SELECT,
    });
  }

  async getService(id: number): Promise<AdminService> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: ADMIN_SERVICE_SELECT,
    });
    if (!service) {
      throw new NotFoundException(SERVICE_NOT_FOUND);
    }
    return service;
  }

  async createService(dto: CreateServiceDto): Promise<AdminService> {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new UnprocessableEntityException(
        'Không sinh được slug từ tên, vui lòng nhập slug',
      );
    }
    await this.assertSlugAvailable(slug);

    try {
      return await this.prisma.service.create({
        data: {
          name: dto.name,
          slug,
          description: emptyToNull(dto.description),
          imageUrl: emptyToNull(dto.imageUrl),
          minCharge: dto.minCharge,
          sortOrder: dto.sortOrder,
        },
        select: ADMIN_SERVICE_SELECT,
      });
    } catch (error) {
      throw mapSlugViolation(error);
    }
  }

  async updateService(
    id: number,
    dto: UpdateServiceDto,
  ): Promise<AdminService> {
    await this.findServiceOrThrow(id);
    if (dto.slug) {
      await this.assertSlugAvailable(dto.slug, id);
    }

    try {
      return await this.prisma.service.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: emptyToNull(dto.description),
          imageUrl: emptyToNull(dto.imageUrl),
          minCharge: dto.minCharge,
          sortOrder: dto.sortOrder,
        },
        select: ADMIN_SERVICE_SELECT,
      });
    } catch (error) {
      throw mapSlugViolation(error);
    }
  }

  /** U02: tắt thay cho xóa; booking cũ đã snapshot nên không bị ảnh hưởng (P02). */
  async setServiceActive(id: number, isActive: boolean): Promise<AdminService> {
    await this.findServiceOrThrow(id);
    return this.prisma.service.update({
      where: { id },
      data: { isActive },
      select: ADMIN_SERVICE_SELECT,
    });
  }

  // ---------- Admin: hạng mục giá (A01, Q01) ----------

  async createItem(
    serviceId: number,
    dto: CreateServiceItemDto,
  ): Promise<AdminServiceItem> {
    await this.findServiceOrThrow(serviceId);
    assertItemQuantityRules({
      minQty: dto.minQty,
      maxQty: dto.maxQty,
      isRequired: dto.isRequired ?? false,
    });

    return this.prisma.serviceItem.create({
      data: { ...dto, serviceId },
      select: ADMIN_ITEM_SELECT,
    });
  }

  async updateItem(
    serviceId: number,
    itemId: number,
    dto: UpdateServiceItemDto,
  ): Promise<AdminServiceItem> {
    const current = await this.findItemOrThrow(serviceId, itemId);
    // Kiểm tra trên giá trị sau khi sửa, vì có thể chỉ gửi một trong các field.
    assertItemQuantityRules({
      minQty: dto.minQty ?? current.minQty,
      maxQty: dto.maxQty ?? current.maxQty,
      isRequired: dto.isRequired ?? current.isRequired,
    });

    return this.prisma.serviceItem.update({
      where: { id: itemId },
      data: dto,
      select: ADMIN_ITEM_SELECT,
    });
  }

  async setItemActive(
    serviceId: number,
    itemId: number,
    isActive: boolean,
  ): Promise<AdminServiceItem> {
    await this.findItemOrThrow(serviceId, itemId);
    return this.prisma.serviceItem.update({
      where: { id: itemId },
      data: { isActive },
      select: ADMIN_ITEM_SELECT,
    });
  }

  private async findServiceOrThrow(id: number) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!service) {
      throw new NotFoundException(SERVICE_NOT_FOUND);
    }
    return service;
  }

  /** Hạng mục phải thuộc đúng dịch vụ trên URL. */
  private async findItemOrThrow(serviceId: number, itemId: number) {
    const item = await this.prisma.serviceItem.findFirst({
      where: { id: itemId, serviceId },
      select: { minQty: true, maxQty: true, isRequired: true },
    });
    if (!item) {
      throw new NotFoundException(ITEM_NOT_FOUND);
    }
    return item;
  }

  private async assertSlugAvailable(slug: string, exceptId?: number) {
    const owner = await this.prisma.service.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (owner && owner.id !== exceptId) {
      throw new ConflictException(SLUG_TAKEN);
    }
  }
}

/**
 * Q01: 0 ≤ min_qty ≤ max_qty; hạng mục bắt buộc phải đặt ít nhất 1 đơn vị.
 * Vi phạm → 422 (business rule), không phải 400.
 */
export function assertItemQuantityRules(item: {
  minQty: number;
  maxQty: number;
  isRequired: boolean;
}) {
  if (item.minQty > item.maxQty) {
    throw new UnprocessableEntityException(
      'Số lượng tối thiểu không được lớn hơn số lượng tối đa',
    );
  }
  if (item.isRequired && item.minQty < 1) {
    throw new UnprocessableEntityException(
      'Hạng mục bắt buộc phải có số lượng tối thiểu từ 1',
    );
  }
}

/** undefined: không sửa; chuỗi rỗng: xóa giá trị. */
function emptyToNull(value: string | undefined): string | null | undefined {
  return value === '' ? null : value;
}

function mapSlugViolation(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException(SLUG_TAKEN);
  }
  return error;
}
