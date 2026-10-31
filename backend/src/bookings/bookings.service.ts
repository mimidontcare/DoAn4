import { randomInt } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingAction,
  BookingStatus,
  CancelReason,
  Prisma,
  WardType,
} from '@prisma/client';
import { AreasService } from '../areas/areas.service';
import type { Paginated } from '../common/dto/pagination.dto';
import { toZoned } from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';
import {
  ADMIN_BOOKING_DETAIL_SELECT,
  ADMIN_BOOKING_SUMMARY_SELECT,
  AdminBookingDetailView,
  AdminBookingSummaryView,
  BOOKING_DETAIL_SELECT,
  BOOKING_SUMMARY_SELECT,
  BookingDetailView,
  BookingSummaryView,
  toAdminBookingDetail,
  toAdminBookingSummary,
  toBookingDetail,
} from './booking.select';
import {
  assessCustomerCancel,
  CancelPolicy,
  recordBookingHistory,
  transitionBooking,
} from './booking-state';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListAdminBookingsQueryDto } from './dto/list-admin-bookings-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import {
  PriceBreakdown,
  PricingService,
  RequestedItem,
} from './pricing.service';

const WARD_TYPE_LABEL: Record<WardType, string> = {
  PHUONG: 'Phường',
  XA: 'Xã',
};

const CODE_PREFIX = 'BK';
// Bỏ các ký tự dễ nhầm (0/O, 1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RANDOM_LENGTH = 4;

export interface QuoteResult extends PriceBreakdown {
  availableStartTimes: Date[];
}

/** C06–C09: báo giá, tạo, xem và hủy booking của khách; A06: admin xem và hủy. */
@Injectable()
export class BookingsService {
  private readonly tz: string;
  private readonly maxPending: number;
  private readonly cancelPolicy: CancelPolicy;

  constructor(
    private readonly prisma: PrismaService,
    private readonly areas: AreasService,
    private readonly pricing: PricingService,
    private readonly availability: AvailabilityService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<string>('timezone');
    this.maxPending = config.getOrThrow<number>(
      'booking.maxPendingPerCustomer',
    );
    this.cancelPolicy = {
      minHoursBeforeStart: config.getOrThrow<number>('booking.cancelMinHours'),
      lateCancelHours: config.getOrThrow<number>('booking.lateCancelHours'),
    };
  }

  async quote(customerId: number, dto: QuoteBookingDto): Promise<QuoteResult> {
    const { price, zoneId } = await this.prepare(customerId, dto);
    const availableStartTimes = await this.availability.listStartTimes(
      zoneId,
      dto.date,
      price.staffCount,
      price.durationMinutes,
    );
    return { ...price, availableStartTimes };
  }

  async create(
    customerId: number,
    dto: CreateBookingDto,
  ): Promise<BookingDetailView> {
    const { price, zoneId, service, address, ward } = await this.prepare(
      customerId,
      dto,
    );
    // expectedTotal chỉ để phát hiện giá đổi sau khi báo giá, không dùng làm giá (P01).
    if (dto.expectedTotal !== price.total) {
      throw new ConflictException('Giá đã thay đổi, vui lòng báo giá lại');
    }
    const startAt = new Date(dto.startAt);
    this.availability.assertStartTimeAllowed(startAt, price.durationMinutes);

    const id = await this.prisma.$transaction(async (tx) => {
      // Khóa dòng user: các request của cùng một khách chạy lần lượt, nên giới
      // hạn đơn PENDING đúng và bấm đặt 2 lần không tạo 2 đơn.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${customerId} FOR UPDATE`;

      const duplicate = await tx.booking.findFirst({
        where: {
          customerId,
          serviceId: dto.serviceId,
          startAt,
          status: BookingStatus.PENDING,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('Bạn đã đặt dịch vụ này vào giờ này');
      }
      const pendingCount = await tx.booking.count({
        where: { customerId, status: BookingStatus.PENDING },
      });
      if (pendingCount >= this.maxPending) {
        throw new UnprocessableEntityException(
          `Mỗi khách chỉ có tối đa ${this.maxPending} đơn đang chờ xử lý`,
        );
      }
      const isAvailable = await this.availability.isSlotAvailable(
        tx,
        zoneId,
        startAt,
        price.staffCount,
        price.durationMinutes,
      );
      if (!isAvailable) {
        throw new ConflictException(
          'Giờ này vừa hết chỗ, vui lòng chọn giờ khác',
        );
      }

      const booking = await tx.booking.create({
        data: {
          code: await this.generateCode(tx, startAt),
          customerId,
          serviceId: dto.serviceId,
          wardId: ward.id,
          zoneId,
          serviceName: service.name,
          addressText: `${address.detail}, ${WARD_TYPE_LABEL[ward.type]} ${ward.name}, ${ward.province.name}`,
          contactName: address.contactName,
          contactPhone: address.contactPhone,
          startAt,
          endAt: this.availability.endOf(startAt, price.durationMinutes),
          manMinutes: price.manMinutes,
          staffCount: price.staffCount,
          durationMinutes: price.durationMinutes,
          itemsTotal: price.itemsTotal,
          subtotal: price.subtotal,
          surcharge: price.surcharge,
          totalPrice: price.total,
          note: dto.note,
          items: {
            create: price.lines.map(({ name, ...line }) => ({
              ...line,
              nameSnapshot: name,
            })),
          },
        },
        select: { id: true },
      });
      await recordBookingHistory(tx, {
        bookingId: booking.id,
        fromStatus: null,
        toStatus: BookingStatus.PENDING,
        action: BookingAction.CREATE,
        changedBy: customerId,
      });
      return booking.id;
    });
    return this.getOwned(customerId, id);
  }

  async listOwned(
    customerId: number,
    query: ListBookingsQueryDto,
  ): Promise<Paginated<BookingSummaryView>> {
    const where: Prisma.BookingWhereInput = {
      customerId,
      status: query.status,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: BOOKING_SUMMARY_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getOwned(customerId: number, id: number): Promise<BookingDetailView> {
    await this.findOwnedOrThrow(customerId, id);
    const row = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      select: BOOKING_DETAIL_SELECT,
    });
    return toBookingDetail(row);
  }

  async cancelOwned(
    customerId: number,
    id: number,
    dto: CancelBookingDto,
  ): Promise<BookingDetailView> {
    const booking = await this.findOwnedOrThrow(customerId, id);
    const now = new Date();
    const { isLate } = assessCustomerCancel(booking, now, this.cancelPolicy);

    await this.prisma.$transaction(async (tx) => {
      await transitionBooking(tx, {
        booking,
        to: BookingStatus.CANCELLED,
        action: BookingAction.CANCEL,
        changedBy: customerId,
        note: dto.note,
        data: {
          cancelReason: CancelReason.CUSTOMER_REQUEST,
          cancelNote: dto.note,
          cancelledBy: customerId,
          cancelledAt: now,
        },
      });
      if (isLate) {
        await tx.user.update({
          where: { id: customerId },
          data: { lateCancelCount: { increment: 1 } },
        });
      }
    });
    return this.getOwned(customerId, id);
  }

  async listAll(
    query: ListAdminBookingsQueryDto,
  ): Promise<Paginated<AdminBookingSummaryView>> {
    const where: Prisma.BookingWhereInput = {
      status: query.status,
      ...(query.q && { code: { contains: query.q } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ADMIN_BOOKING_SUMMARY_SELECT,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: rows.map(toAdminBookingSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getForAdmin(id: number): Promise<AdminBookingDetailView> {
    const row = await this.prisma.booking.findUnique({
      where: { id },
      select: ADMIN_BOOKING_DETAIL_SELECT,
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    return toAdminBookingDetail(row);
  }

  /** Admin hủy PENDING hoặc CONFIRMED; bảng chuyển trạng thái chặn các trạng thái khác. */
  async cancelByAdmin(
    adminId: number,
    id: number,
    dto: AdminCancelBookingDto,
  ): Promise<AdminBookingDetailView> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, version: true },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    await this.prisma.$transaction((tx) =>
      transitionBooking(tx, {
        booking,
        to: BookingStatus.CANCELLED,
        action: BookingAction.CANCEL,
        changedBy: adminId,
        note: dto.note,
        data: {
          cancelReason: dto.reason,
          cancelNote: dto.note,
          cancelledBy: adminId,
          cancelledAt: new Date(),
        },
      }),
    );
    return this.getForAdmin(id);
  }

  /** Kiểm tra chung của báo giá và tạo đơn; giá tính lại từ bảng giá hiện tại (P01). */
  private async prepare(
    customerId: number,
    dto: { serviceId: number; addressId: number; items: RequestedItem[] },
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, isActive: true },
      select: {
        name: true,
        minCharge: true,
        items: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            unit: true,
            unitPrice: true,
            minutesPerUnit: true,
            minQty: true,
            maxQty: true,
            isRequired: true,
          },
        },
      },
    });
    if (!service) {
      throw new NotFoundException('Không tìm thấy dịch vụ');
    }
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId: customerId, isDeleted: false },
      select: {
        detail: true,
        contactName: true,
        contactPhone: true,
        wardId: true,
      },
    });
    if (!address) {
      throw new NotFoundException('Không tìm thấy địa chỉ');
    }
    const ward = await this.areas.assertWardServiceable(address.wardId);
    if (!ward.zone) {
      throw new UnprocessableEntityException(
        'Phường/xã này hiện chưa nằm trong vùng phục vụ',
      );
    }
    const price = this.pricing.calculate(service, dto.items);
    return { price, zoneId: ward.zone.id, service, address, ward };
  }

  private async findOwnedOrThrow(customerId: number, id: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        version: true,
        startAt: true,
      },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn');
    }
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Bạn không có quyền với đơn này');
    }
    return booking;
  }

  /** BK + yyMMdd của giờ bắt đầu + 4 ký tự ngẫu nhiên. */
  private async generateCode(
    tx: Prisma.TransactionClient,
    startAt: Date,
  ): Promise<string> {
    const day = toZoned(startAt, this.tz).format('YYMMDD');
    for (;;) {
      const random = Array.from(
        { length: CODE_RANDOM_LENGTH },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join('');
      const code = `${CODE_PREFIX}${day}${random}`;
      const taken = await tx.booking.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!taken) return code;
    }
  }
}
