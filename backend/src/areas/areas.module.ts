import { Module } from '@nestjs/common';
import { AdminAreasController } from './admin-areas.controller';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';

@Module({
  controllers: [AreasController, AdminAreasController],
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}
