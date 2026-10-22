import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AuthModule } from '../auth/auth.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { AdminUsersController } from './admin-users.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, AreasModule],
  controllers: [UsersController, AddressesController, AdminUsersController],
  providers: [UsersService, AddressesService],
})
export class UsersModule {}
