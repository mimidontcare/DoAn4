import { Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import type { PublicUser } from './user.select';
import { UsersService } from './users.service';

@ApiTags('admin / users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Patch(':id/lock')
  @ApiOperation({
    summary: 'Khóa tài khoản nhân viên/khách, thu hồi mọi phiên',
  })
  lock(@Param('id', ParseIntPipe) id: number): Promise<PublicUser> {
    return this.users.setStatus(id, UserStatus.LOCKED);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Mở khóa tài khoản' })
  unlock(@Param('id', ParseIntPipe) id: number): Promise<PublicUser> {
    return this.users.setStatus(id, UserStatus.ACTIVE);
  }
}
