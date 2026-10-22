import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import type {
  AdminService,
  AdminServiceItem,
  AdminServiceSummary,
} from './catalog.select';
import { CatalogService } from './catalog.service';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateServiceItemDto } from './dto/update-service-item.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

/** Không có DELETE: dịch vụ và hạng mục chỉ bật/tắt (U02). */
@ApiTags('admin / services')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/services')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Mọi dịch vụ, kể cả đang tắt' })
  list(): Promise<AdminServiceSummary[]> {
    return this.catalog.listServices();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo dịch vụ' })
  create(@Body() dto: CreateServiceDto): Promise<AdminService> {
    return this.catalog.createService(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết dịch vụ kèm mọi hạng mục' })
  detail(@Param('id', ParseIntPipe) id: number): Promise<AdminService> {
    return this.catalog.getService(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Sửa dịch vụ' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
  ): Promise<AdminService> {
    return this.catalog.updateService(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Bật/tắt dịch vụ' })
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ): Promise<AdminService> {
    return this.catalog.setServiceActive(id, dto.isActive);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Thêm hạng mục giá' })
  createItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateServiceItemDto,
  ): Promise<AdminServiceItem> {
    return this.catalog.createItem(id, dto);
  }

  @Put(':id/items/:itemId')
  @ApiOperation({ summary: 'Sửa hạng mục giá' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateServiceItemDto,
  ): Promise<AdminServiceItem> {
    return this.catalog.updateItem(id, itemId, dto);
  }

  @Patch(':id/items/:itemId/status')
  @ApiOperation({ summary: 'Bật/tắt hạng mục giá' })
  setItemActive(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: SetActiveDto,
  ): Promise<AdminServiceItem> {
    return this.catalog.setItemActive(id, itemId, dto.isActive);
  }
}
