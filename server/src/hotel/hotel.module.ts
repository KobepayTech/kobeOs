import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  HotelBooking, HotelGuest, HotelMenuItem, HotelOrder, HotelRoom, HotelServiceRequest,
} from './hotel.entity';
import {
  BookingsService, GuestsService, MenuItemsService, OrdersService,
  RoomsService, ServiceRequestsService,
} from './hotel.service';
import { HotelController } from './hotel.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    HotelRoom, HotelGuest, HotelBooking, HotelMenuItem, HotelOrder, HotelServiceRequest,
  ])],
  // BookingsService needs HotelRoom repo to check availability and update room status.
  providers: [
    RoomsService, GuestsService, BookingsService,
    MenuItemsService, OrdersService, ServiceRequestsService,
  ],
  controllers: [HotelController],
})
export class HotelModule {}
