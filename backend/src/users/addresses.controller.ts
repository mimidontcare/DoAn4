import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AddressView } from './address.select';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import type { PublicUser } from './user.select';

@ApiTags('me / addresses')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller('me/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Địa chỉ của tôi (mặc định đứng đầu)' })
  list(@CurrentUser() user: PublicUser): Promise<AddressView[]> {
    return this.addresses.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm địa chỉ; phường phải trong vùng phục vụ' })
  create(
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressView> {
    return this.addresses.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Sửa địa chỉ' })
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressView> {
    return this.addresses.update(user.id, id, dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Đặt làm địa chỉ mặc định' })
  setDefault(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AddressView> {
    return this.addresses.setDefault(user.id, id);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa địa chỉ (xóa mềm)' })
  remove(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
