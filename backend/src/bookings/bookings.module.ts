import { Module } from '@nestjs/common';
import { AreasModule } from '../areas/areas.module';
import { AdjustmentService } from './adjustment.service';
import { AdminBookingsController } from './admin-bookings.controller';
import { AssignmentService } from './assignment.service';
import { AvailabilityService } from './availability.service';
import { BookingsService } from './bookings.service';
import { CustomerBookingsController } from './customer-bookings.controller';
import { PricingService } from './pricing.service';
import { StaffBookingsController } from './staff-bookings.controller';
import { StaffBookingsService } from './staff-bookings.service';

@Module({
  imports: [AreasModule],
  controllers: [
    CustomerBookingsController,
    StaffBookingsController,
    AdminBookingsController,
  ],
  providers: [
    BookingsService,
    PricingService,
    AvailabilityService,
    AssignmentService,
    AdjustmentService,
    StaffBookingsService,
  ],
})
export class BookingsModule {}
