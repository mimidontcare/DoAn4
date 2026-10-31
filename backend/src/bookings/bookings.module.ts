import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { AssignmentService } from './assignment.service';
import { AvailabilityService } from './availability.service';
import { BookingsService } from './bookings.service';
import { CustomerBookingsController } from './customer-bookings.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [AreasModule],
  controllers: [CustomerBookingsController, AdminBookingsController],
  providers: [
    BookingsService,
    PricingService,
    AvailabilityService,
    AssignmentService,
  ],
})
export class BookingsModule {}
