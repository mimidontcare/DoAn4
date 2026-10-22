import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import type { Paginated } from '../common/dto/pagination.dto';
import type { ProvinceView, WardView, ZoneView } from './areas.select';
import { AreasService } from './areas.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { ListWardsQueryDto } from './dto/list-wards-query.dto';
import { ListZonesQueryDto } from './dto/list-zones-query.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@ApiTags('admin / areas')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminAreasController {
  constructor(private readonly areas: AreasService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Danh sách tỉnh/thành' })
  listProvinces(): Promise<ProvinceView[]> {
    return this.areas.listProvinces();
  }

  @Patch('provinces/:id/activate')
  @ApiOperation({ summary: 'Bật tỉnh này, tắt tỉnh đang hoạt động (Z02)' })
  activateProvince(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProvinceView> {
    return this.areas.activateProvince(id);
  }

  @Get('zones')
  @ApiOperation({ summary: 'Danh sách khu vực' })
  listZones(@Query() query: ListZonesQueryDto): Promise<ZoneView[]> {
    return this.areas.listZones(query.provinceId);
  }

  @Post('zones')
  @ApiOperation({ summary: 'Tạo khu vực' })
  createZone(@Body() dto: CreateZoneDto): Promise<ZoneView> {
    return this.areas.createZone(dto);
  }

  @Put('zones/:id')
  @ApiOperation({ summary: 'Sửa tên, bật/tắt khu vực' })
  updateZone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateZoneDto,
  ): Promise<ZoneView> {
    return this.areas.updateZone(id, dto);
  }

  @Get('wards')
  @ApiOperation({ summary: 'Danh sách phường/xã, có lọc và phân trang' })
  listWards(@Query() query: ListWardsQueryDto): Promise<Paginated<WardView>> {
    return this.areas.listWards(query);
  }

  @Patch('wards/:id')
  @ApiOperation({ summary: 'Gán khu vực, bật/tắt phường/xã (Z01)' })
  updateWard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWardDto,
  ): Promise<WardView> {
    return this.areas.updateWard(id, dto);
  }
}
