import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AvailabilityService } from './availability.service';
import { BookingsService } from './bookings.service';
import { CustomerBookingsController } from './customer-bookings.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [AreasModule],
  controllers: [CustomerBookingsController],
  providers: [BookingsService, PricingService, AvailabilityService],
})
export class BookingsModule {}
