import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  HotelBooking, HotelGuest, HotelMenuItem, HotelOrder, HotelRoom, HotelServiceRequest, HotelTenant,
} from './hotel.entity';
import {
  BookingsService, GuestsService, MenuItemsService, OrdersService,
  RoomsService, ServiceRequestsService, TenantsService,
} from './hotel.service';
import { HotelController } from './hotel.controller';
import { PublicHotelController } from './public-hotel.controller';
import { HotelGateway } from './hotel.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelRoom, HotelGuest, HotelBooking, HotelMenuItem, HotelOrder, HotelServiceRequest, HotelTenant,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  // BookingsService needs HotelRoom repo to check availability and update room status.
  providers: [
    RoomsService, GuestsService, BookingsService,
    MenuItemsService, OrdersService, ServiceRequestsService,
    TenantsService, HotelGateway,
  ],
  controllers: [HotelController, PublicHotelController],
})
export class HotelModule {}
