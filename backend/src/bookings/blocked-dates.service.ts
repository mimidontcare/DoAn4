import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import dayjs from 'dayjs';
// Nạp plugin utc, timezone cho dayjs.
import '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockedDateDto } from './dto/create-blocked-date.dto';

export interface BlockedDateView {
  id: number;
  /** "YYYY-MM-DD" theo múi giờ nghiệp vụ. */
  date: string;
  reason: string | null;
  createdAt: Date;
}

const SELECT = { id: true, date: true, reason: true, createdAt: true } as const;

/** Cột DATE lưu ngày nghiệp vụ dưới dạng 00:00 UTC; đổi qua lại với "YYYY-MM-DD". */
const toDateColumn = (date: string) => new Date(`${date}T00:00:00.000Z`);
const fromDateColumn = (date: Date) => date.toISOString().slice(0, 10);

const toView = (row: {
  id: number;
  date: Date;
  reason: string | null;
  createdAt: Date;
}) => ({
  ...row,
  date: fromDateColumn(row.date),
});

/** T08: ngày không phục vụ do admin nhập; báo giá và đổi lịch bỏ qua các ngày này. */
@Injectable()
export class BlockedDatesService {
  private readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.tz = config.getOrThrow<string>('timezone');
  }

  /** Các ngày từ hôm nay trở đi. */
  async listUpcoming(): Promise<BlockedDateView[]> {
    const today = dayjs().tz(this.tz).format('YYYY-MM-DD');
    const rows = await this.prisma.blockedDate.findMany({
      where: { date: { gte: toDateColumn(today) } },
      orderBy: { date: 'asc' },
      select: SELECT,
    });
    return rows.map(toView);
  }

  /**
   * Không tự hủy đơn đã có trong ngày đó; trả về số đơn bị ảnh hưởng để admin xử lý.
   */
  async create(
    adminId: number,
    dto: CreateBlockedDateDto,
  ): Promise<BlockedDateView & { affectedBookings: number }> {
    const today = dayjs().tz(this.tz).format('YYYY-MM-DD');
    if (dto.date < today) {
      throw new UnprocessableEntityException('Không chặn ngày đã qua');
    }
    const existing = await this.prisma.blockedDate.findUnique({
      where: { date: toDateColumn(dto.date) },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Ngày này đã có trong danh sách');
    }
    const row = await this.prisma.blockedDate.create({
      data: {
        date: toDateColumn(dto.date),
        reason: dto.reason || null,
        createdBy: adminId,
      },
      select: SELECT,
    });
    const dayStart = dayjs.tz(dto.date, this.tz);
    const affectedBookings = await this.prisma.booking.count({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        startAt: {
          gte: dayStart.toDate(),
          lt: dayStart.add(1, 'day').toDate(),
        },
      },
    });
    return { ...toView(row), affectedBookings };
  }

  async remove(id: number): Promise<void> {
    const { count } = await this.prisma.blockedDate.deleteMany({
      where: { id },
    });
    if (count === 0) {
      throw new NotFoundException('Không tìm thấy ngày nghỉ');
    }
  }
}
