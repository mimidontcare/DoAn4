import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdjustmentStatus,
  BookingAction,
  BookingStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildProposal,
  maxAdjustedManMinutes,
  ProposedItem,
} from './adjustment';
import type {
  AdminBookingDetailView,
  BookingDetailView,
} from './booking.select';
import { updateBookingInPlace } from './booking-state';
import { BookingsService } from './bookings.service';
import { totalsOf } from './pricing.service';

const vnd = new Intl.NumberFormat('vi-VN');

interface AdjustableBooking {
  id: number;
  status: BookingStatus;
  version: number;
  serviceId: number;
  adjustmentStatus: AdjustmentStatus;
  originalManMinutes: number;
}

/** A01–A05: trưởng nhóm đề xuất, khách (hoặc admin thay khách) xác nhận. */
@Injectable()
export class AdjustmentService {
  private readonly maxPercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    config: ConfigService,
  ) {
    this.maxPercent = config.getOrThrow<number>('booking.maxAdjustmentPercent');
  }

  maxManMinutes(originalManMinutes: number): number {
    return maxAdjustedManMinutes(originalManMinutes, this.maxPercent);
  }

  /** Người gọi đã kiểm tra là trưởng nhóm của đơn (A01). */
  async propose(
    leaderId: number,
    booking: AdjustableBooking,
    items: ProposedItem[],
  ): Promise<void> {
    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new UnprocessableEntityException(
        'Chỉ đề xuất điều chỉnh khi đang thực hiện',
      );
    }
    if (booking.adjustmentStatus === AdjustmentStatus.PENDING) {
      throw new UnprocessableEntityException(
        'Đơn đang có một đề xuất chờ khách xác nhận',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const [booked, catalog] = await Promise.all([
        tx.bookingItem.findMany({
          where: { bookingId: booking.id },
          select: {
            id: true,
            serviceItemId: true,
            quantity: true,
            minutesPerUnit: true,
          },
        }),
        tx.serviceItem.findMany({
          where: { serviceId: booking.serviceId },
          select: {
            id: true,
            name: true,
            unit: true,
            unitPrice: true,
            minutesPerUnit: true,
            minQty: true,
            maxQty: true,
            isRequired: true,
            isActive: true,
          },
        }),
      ]);
      const proposal = buildProposal(
        booked,
        catalog,
        items,
        this.maxManMinutes(booking.originalManMinutes),
      );

      // Cập nhật booking trước: request song song chỉ một bên qua được điều kiện.
      await updateBookingInPlace(tx, {
        booking,
        action: BookingAction.ADJUST,
        changedBy: leaderId,
        note: `Đề xuất điều chỉnh: ${proposal.manMinutes} phút công`,
        where: { adjustmentStatus: { not: AdjustmentStatus.PENDING } },
        data: { adjustmentStatus: AdjustmentStatus.PENDING },
      });
      for (const update of proposal.updates) {
        await tx.bookingItem.update({
          where: { id: update.id },
          data: { proposedQuantity: update.proposedQuantity },
        });
      }
      if (proposal.additions.length > 0) {
        await tx.bookingItem.createMany({
          data: proposal.additions.map((a) => ({
            ...a,
            bookingId: booking.id,
            quantity: 0,
            amount: 0,
          })),
        });
      }
    });
  }

  async respondAsCustomer(
    customerId: number,
    id: number,
    accept: boolean,
  ): Promise<BookingDetailView> {
    await this.bookings.findOwnedOrThrow(customerId, id);
    await this.respond(id, accept, customerId, null);
    return this.bookings.getOwned(customerId, id);
  }

  /** A03: khách không dùng app được, admin gọi điện và xác nhận thay. */
  async respondAsAdmin(
    adminId: number,
    id: number,
    accept: boolean,
  ): Promise<AdminBookingDetailView> {
    await this.respond(id, accept, adminId, 'Quản trị xác nhận thay khách');
    return this.bookings.getForAdmin(id);
  }

  /** A03: chấp nhận thì áp dụng và tính lại giá; từ chối thì giữ khối lượng đã đặt. */
  private async respond(
    id: number,
    accept: boolean,
    actorId: number,
    actorNote: string | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          version: true,
          adjustmentStatus: true,
          minCharge: true,
          items: {
            select: {
              id: true,
              quantity: true,
              proposedQuantity: true,
              unitPrice: true,
              minutesPerUnit: true,
            },
          },
        },
      });
      if (!booking) {
        throw new NotFoundException('Không tìm thấy đơn');
      }
      if (
        booking.status !== BookingStatus.IN_PROGRESS ||
        booking.adjustmentStatus !== AdjustmentStatus.PENDING
      ) {
        throw new UnprocessableEntityException(
          'Đơn không có đề xuất điều chỉnh đang chờ',
        );
      }

      const finalLines = booking.items.map((item) => ({
        ...item,
        quantity: accept
          ? (item.proposedQuantity ?? item.quantity)
          : item.quantity,
      }));
      const totals = totalsOf(finalLines, booking.minCharge);
      const decision = accept ? 'Chấp nhận' : 'Từ chối';
      await updateBookingInPlace(tx, {
        booking,
        action: BookingAction.ADJUST,
        changedBy: actorId,
        note: [
          actorNote,
          accept
            ? `${decision} điều chỉnh, tổng mới ${vnd.format(totals.total)}đ`
            : `${decision} điều chỉnh, giữ khối lượng đã đặt`,
        ]
          .filter(Boolean)
          .join('. '),
        where: { adjustmentStatus: AdjustmentStatus.PENDING },
        data: {
          adjustmentStatus: accept
            ? AdjustmentStatus.ACCEPTED
            : AdjustmentStatus.REJECTED,
          ...(accept && {
            manMinutes: totals.manMinutes,
            itemsTotal: totals.itemsTotal,
            subtotal: totals.subtotal,
            surcharge: totals.surcharge,
            totalPrice: totals.total,
          }),
        },
      });
      await this.applyToItems(tx, finalLines);
    });
  }

  /** Dòng còn khối lượng 0 (bỏ hạng mục, hoặc hạng mục mới bị từ chối) bị xóa khỏi đơn. */
  private async applyToItems(
    tx: Prisma.TransactionClient,
    lines: { id: number; quantity: number; unitPrice: number }[],
  ): Promise<void> {
    const empty = lines.filter((line) => line.quantity === 0);
    if (empty.length > 0) {
      await tx.bookingItem.deleteMany({
        where: { id: { in: empty.map((line) => line.id) } },
      });
    }
    for (const line of lines.filter((l) => l.quantity > 0)) {
      await tx.bookingItem.update({
        where: { id: line.id },
        data: {
          quantity: line.quantity,
          amount: line.quantity * line.unitPrice,
          proposedQuantity: null,
        },
      });
    }
  }
}
