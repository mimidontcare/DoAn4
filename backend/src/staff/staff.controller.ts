import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { Paginated } from '../common/dto/pagination.dto';
import type { PublicUser } from '../users/user.select';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { SetStaffZonesDto } from './dto/set-staff-zones.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import type { StaffView, UnavailabilityView } from './staff.select';
import { StaffService } from './staff.service';

/** Khóa/mở khóa nhân viên dùng chung /admin/users/:id/lock|unlock. */
@ApiTags('admin / staff')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhân viên, lọc theo khu vực/trạng thái' })
  list(@Query() query: ListStaffQueryDto): Promise<Paginated<StaffView>> {
    return this.staff.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo nhân viên với mật khẩu tạm (bắt đổi lần đầu)' })
  create(@Body() dto: CreateStaffDto): Promise<StaffView> {
    return this.staff.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhân viên kèm khu vực' })
  get(@Param('id', ParseIntPipe) id: number): Promise<StaffView> {
    return this.staff.get(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Sửa họ tên, SĐT nhân viên' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffView> {
    return this.staff.update(id, dto);
  }

  @Put(':id/zones')
  @ApiOperation({ summary: 'Thay toàn bộ khu vực phục vụ của nhân viên' })
  setZones(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetStaffZonesDto,
  ): Promise<StaffView> {
    return this.staff.setZones(id, dto.zoneIds);
  }

  @Get(':id/unavailabilities')
  @ApiOperation({ summary: 'Lịch nghỉ của nhân viên' })
  listUnavailabilities(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UnavailabilityView[]> {
    return this.staff.listUnavailabilities(id);
  }

  @Post(':id/unavailabilities')
  @ApiOperation({ summary: 'Thêm lịch nghỉ (thời gian ISO có múi giờ)' })
  createUnavailability(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: PublicUser,
    @Body() dto: CreateUnavailabilityDto,
  ): Promise<UnavailabilityView> {
    return this.staff.createUnavailability(id, admin.id, dto);
  }

  @Delete(':id/unavailabilities/:uid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa lịch nghỉ' })
  deleteUnavailability(
    @Param('id', ParseIntPipe) id: number,
    @Param('uid', ParseIntPipe) uid: number,
  ): Promise<void> {
    return this.staff.deleteUnavailability(id, uid);
  }
}
