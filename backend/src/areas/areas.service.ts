import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROVINCE_SELECT,
  ProvinceView,
  PUBLIC_ZONE_SELECT,
  SERVICEABILITY_SELECT,
  ServiceAreas,
  WARD_SELECT,
  WardView,
  ZONE_SELECT,
  ZoneView,
} from './areas.select';
import { CreateZoneDto } from './dto/create-zone.dto';
import { ListWardsQueryDto } from './dto/list-wards-query.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

const ZONE_NAME_TAKEN = 'Tên khu vực đã có trong tỉnh này';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phường/xã đang phục vụ của tỉnh đang hoạt động, nhóm theo khu vực.
   * Tên tỉnh lấy từ DB, không hardcode (Z03).
   */
  async getServiceAreas(): Promise<ServiceAreas> {
    const province = await this.prisma.province.findFirst({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (!province) {
      return { province: null, zones: [] };
    }

    const zones = await this.prisma.serviceZone.findMany({
      where: {
        provinceId: province.id,
        isActive: true,
        wards: { some: { isActive: true } },
      },
      orderBy: { name: 'asc' },
      select: PUBLIC_ZONE_SELECT,
    });
    return { province, zones };
  }

  /**
   * Z01: phường đang bật, thuộc khu vực đang bật của tỉnh đang hoạt động.
   * Dùng khi lưu địa chỉ và (Phase 4) khi đặt lịch. Không đạt → 422.
   */
  async assertWardServiceable(wardId: number) {
    const ward = await this.prisma.ward.findUnique({
      where: { id: wardId },
      select: SERVICEABILITY_SELECT,
    });
    if (!ward || !isWardServiceable(ward)) {
      throw new UnprocessableEntityException(
        'Phường/xã này hiện chưa nằm trong vùng phục vụ',
      );
    }
    return ward;
  }

  // ---------- Tỉnh (Z02) ----------

  listProvinces(): Promise<ProvinceView[]> {
    return this.prisma.province.findMany({
      orderBy: { name: 'asc' },
      select: PROVINCE_SELECT,
    });
  }

  /** Z02: bật tỉnh này và tắt mọi tỉnh khác trong cùng transaction. */
  async activateProvince(id: number): Promise<ProvinceView> {
    await this.findProvinceOrThrow(id);
    const [, province] = await this.prisma.$transaction([
      this.prisma.province.updateMany({
        where: { id: { not: id }, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.province.update({
        where: { id },
        data: { isActive: true },
        select: PROVINCE_SELECT,
      }),
    ]);
    return province;
  }

  // ---------- Khu vực ----------

  listZones(provinceId?: number): Promise<ZoneView[]> {
    return this.prisma.serviceZone.findMany({
      where: { provinceId },
      orderBy: [{ provinceId: 'asc' }, { name: 'asc' }],
      select: ZONE_SELECT,
    });
  }

  async createZone(dto: CreateZoneDto): Promise<ZoneView> {
    await this.findProvinceOrThrow(dto.provinceId);
    try {
      return await this.prisma.serviceZone.create({
        data: { provinceId: dto.provinceId, name: dto.name },
        select: ZONE_SELECT,
      });
    } catch (error) {
      throw mapZoneNameViolation(error);
    }
  }

  /** Tắt khu vực thì phường trong đó không còn hiện ở /service-areas (Z01). */
  async updateZone(id: number, dto: UpdateZoneDto): Promise<ZoneView> {
    const zone = await this.prisma.serviceZone.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!zone) {
      throw new NotFoundException('Không tìm thấy khu vực');
    }
    try {
      return await this.prisma.serviceZone.update({
        where: { id },
        data: { name: dto.name, isActive: dto.isActive },
        select: ZONE_SELECT,
      });
    } catch (error) {
      throw mapZoneNameViolation(error);
    }
  }

  // ---------- Phường/xã (Z01) ----------

  async listWards(query: ListWardsQueryDto): Promise<Paginated<WardView>> {
    const where: Prisma.WardWhereInput = {
      provinceId: query.provinceId,
      isActive: query.isActive,
      zoneId: query.unassigned ? null : query.zoneId,
      ...(query.q && {
        OR: [
          { name: { contains: query.q } },
          { oldNameHint: { contains: query.q } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ward.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: WARD_SELECT,
      }),
      this.prisma.ward.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Gán khu vực và bật/tắt phường.
   * - Khu vực phải cùng tỉnh với phường.
   * - Z01: phường chưa thuộc khu vực nào thì không bật được; gỡ khỏi khu vực thì tự tắt.
   */
  async updateWard(id: number, dto: UpdateWardDto): Promise<WardView> {
    const ward = await this.prisma.ward.findUnique({
      where: { id },
      select: { provinceId: true, zoneId: true, isActive: true },
    });
    if (!ward) {
      throw new NotFoundException('Không tìm thấy phường/xã');
    }

    const zoneId = dto.zoneId === undefined ? ward.zoneId : dto.zoneId;
    if (dto.zoneId != null) {
      const zone = await this.prisma.serviceZone.findUnique({
        where: { id: dto.zoneId },
        select: { provinceId: true },
      });
      if (!zone) {
        throw new UnprocessableEntityException('Khu vực không tồn tại');
      }
      if (zone.provinceId !== ward.provinceId) {
        throw new UnprocessableEntityException(
          'Khu vực không thuộc cùng tỉnh với phường/xã',
        );
      }
    }

    const isActive = resolveWardActive({
      zoneId,
      requested: dto.isActive,
      current: ward.isActive,
    });
    return this.prisma.ward.update({
      where: { id },
      data: { zoneId, isActive },
      select: WARD_SELECT,
    });
  }

  private async findProvinceOrThrow(id: number) {
    const province = await this.prisma.province.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!province) {
      throw new NotFoundException('Không tìm thấy tỉnh/thành');
    }
    return province;
  }
}

/** Z01 trên dữ liệu đã nạp bằng SERVICEABILITY_SELECT. */
export function isWardServiceable(ward: {
  isActive: boolean;
  zone: { isActive: boolean } | null;
  province: { isActive: boolean };
}): boolean {
  return ward.isActive && !!ward.zone?.isActive && ward.province.isActive;
}

/** Z01: trạng thái bật/tắt của phường sau khi sửa. */
export function resolveWardActive(input: {
  zoneId: number | null;
  requested: boolean | undefined;
  current: boolean;
}): boolean {
  if (input.zoneId === null) {
    if (input.requested) {
      throw new UnprocessableEntityException(
        'Phải gán phường/xã vào một khu vực trước khi bật',
      );
    }
    return false;
  }
  return input.requested ?? input.current;
}

function mapZoneNameViolation(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException(ZONE_NAME_TAKEN);
  }
  return error;
}
