import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mapUniqueViolation } from '../auth/auth.service';
import {
  findBusyStaffIds,
  lockStaffRows,
  STAFF_LOCK_TX_OPTIONS,
} from '../bookings/staff-schedule';
import type { Paginated } from '../common/dto/pagination.dto';
import { roundRating } from '../common/utils/rating';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import {
  STAFF_SELECT,
  StaffDetailView,
  StaffView,
  toStaffView,
  UNAVAILABILITY_SELECT,
  UnavailabilityView,
} from './staff.select';

const STAFF_NOT_FOUND = 'Không tìm thấy nhân viên';

/** A03, A04: quản lý nhân viên, khu vực phục vụ và lịch nghỉ. Chỉ admin gọi. */
@Injectable()
export class StaffService {
  private readonly bcryptRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.bcryptRounds = config.getOrThrow<number>('auth.bcryptRounds');
  }

  async list(query: ListStaffQueryDto): Promise<Paginated<StaffView>> {
    const where: Prisma.UserWhereInput = {
      role: UserRole.STAFF,
      status: query.status,
      ...(query.zoneId && {
        staffZones: { some: { zoneId: query.zoneId } },
      }),
      ...(query.q && {
        OR: [
          { fullName: { contains: query.q } },
          { email: { contains: query.q } },
          { phone: { contains: query.q } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: STAFF_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map(toStaffView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** V02: điểm của đơn tính cho cả nhóm; đánh giá bị ẩn (V03) không tính. */
  async get(id: number): Promise<StaffDetailView> {
    const row = await this.prisma.user.findFirst({
      where: { id, role: UserRole.STAFF },
      select: STAFF_SELECT,
    });
    if (!row) {
      throw new NotFoundException(STAFF_NOT_FOUND);
    }
    const rating = await this.prisma.review.aggregate({
      where: {
        isHidden: false,
        booking: { assignments: { some: { staffId: id } } },
      },
      _avg: { rating: true },
      _count: true,
    });
    return {
      ...toStaffView(row),
      rating: {
        average: roundRating(rating._avg.rating),
        count: rating._count,
      },
    };
  }

  /** U01: tài khoản STAFF do admin tạo, bắt đổi mật khẩu lần đầu. */
  async create(dto: CreateStaffDto): Promise<StaffView> {
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    try {
      const row = await this.prisma.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          role: UserRole.STAFF,
          mustChangePassword: true,
        },
        select: STAFF_SELECT,
      });
      return toStaffView(row);
    } catch (error) {
      // Email/SĐT trùng → 409 kèm field.
      throw mapUniqueViolation(error);
    }
  }

  async update(id: number, dto: UpdateStaffDto): Promise<StaffView> {
    await this.findStaffOrThrow(id);
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data: { fullName: dto.fullName, phone: dto.phone },
        select: STAFF_SELECT,
      });
      return toStaffView(row);
    } catch (error) {
      throw mapUniqueViolation(error);
    }
  }

  /** Thay toàn bộ khu vực của nhân viên trong một transaction. */
  async setZones(id: number, zoneIds: number[]): Promise<StaffView> {
    await this.findStaffOrThrow(id);
    const found = await this.prisma.serviceZone.count({
      where: { id: { in: zoneIds } },
    });
    if (found !== zoneIds.length) {
      throw new UnprocessableEntityException('Có khu vực không tồn tại');
    }

    await this.prisma.$transaction([
      this.prisma.staffZone.deleteMany({ where: { staffId: id } }),
      this.prisma.staffZone.createMany({
        data: zoneIds.map((zoneId) => ({ staffId: id, zoneId })),
      }),
    ]);
    return this.get(id);
  }

  async listUnavailabilities(staffId: number): Promise<UnavailabilityView[]> {
    await this.findStaffOrThrow(staffId);
    return this.prisma.staffUnavailability.findMany({
      where: { staffId },
      orderBy: { startAt: 'desc' },
      select: UNAVAILABILITY_SELECT,
    });
  }

  /**
   * A04: lịch nghỉ của nhân viên; không chồng lên lịch nghỉ khác của chính người đó
   * và không trùng booking đã giao. Khóa dòng nhân viên trước khi kiểm tra để không
   * lọt qua khi đang có phân công đồng thời.
   */
  async createUnavailability(
    staffId: number,
    adminId: number,
    dto: CreateUnavailabilityDto,
  ): Promise<UnavailabilityView> {
    await this.findStaffOrThrow(staffId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    assertValidRange(startAt, endAt);

    return this.prisma.$transaction(async (tx) => {
      await lockStaffRows(tx, [staffId]);

      const overlap = await tx.staffUnavailability.findFirst({
        where: { staffId, startAt: { lt: endAt }, endAt: { gt: startAt } },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException('Trùng với một lịch nghỉ đã có');
      }
      const busy = await findBusyStaffIds(tx, [staffId], startAt, endAt);
      if (busy.size > 0) {
        throw new ConflictException('Trùng với đơn đã giao cho nhân viên');
      }

      return tx.staffUnavailability.create({
        data: {
          staffId,
          startAt,
          endAt,
          reason: dto.reason || null,
          createdBy: adminId,
        },
        select: UNAVAILABILITY_SELECT,
      });
    }, STAFF_LOCK_TX_OPTIONS);
  }

  async deleteUnavailability(staffId: number, id: number): Promise<void> {
    const { count } = await this.prisma.staffUnavailability.deleteMany({
      where: { id, staffId },
    });
    if (count === 0) {
      throw new NotFoundException('Không tìm thấy lịch nghỉ');
    }
  }

  private async findStaffOrThrow(id: number) {
    const staff = await this.prisma.user.findFirst({
      where: { id, role: UserRole.STAFF },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException(STAFF_NOT_FOUND);
    }
    return staff;
  }
}

/** Khoảng nghỉ hợp lệ: kết thúc sau bắt đầu. */
export function assertValidRange(startAt: Date, endAt: Date) {
  if (endAt <= startAt) {
    throw new UnprocessableEntityException(
      'Thời gian kết thúc phải sau thời gian bắt đầu',
    );
  }
}
