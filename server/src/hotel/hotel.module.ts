import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelBooking, HotelGuest, HotelRoom } from './hotel.entity';
import { BookingsService, GuestsService, RoomsService } from './hotel.service';
import { HotelController } from './hotel.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HotelRoom, HotelGuest, HotelBooking])],
  // BookingsService needs HotelRoom repo to check availability and update room status.
  providers: [RoomsService, GuestsService, BookingsService],
  controllers: [HotelController],
})
export class HotelModule {}
