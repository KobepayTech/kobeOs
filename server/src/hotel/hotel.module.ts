import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  HotelBooking, HotelGuest, HotelMenuItem, HotelOrder, HotelRoom, HotelServiceRequest, HotelTenant,
  HotelChain, HotelParkingSpot, HotelFinancialRecord,
} from './hotel.entity';
import {
  BookingsService, GuestsService, MenuItemsService, OrdersService,
  RoomsService, ServiceRequestsService, TenantsService, HotelChainService,
} from './hotel.service';
import { HotelController } from './hotel.controller';
import { PublicHotelController } from './public-hotel.controller';
import { HotelGateway } from './hotel.gateway';
import { HotelInventoryItem, HotelStaff, HotelChannel } from './hotel-extras.entity';
import { HotelInventoryService, HotelStaffService, HotelChannelsService } from './hotel-extras.service';
import { HotelExtrasController } from './hotel-extras.controller';
import { HotelFrontDeskService } from './hotel-front-desk.service';
import { HotelFrontDeskController } from './hotel-front-desk.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelRoom, HotelGuest, HotelBooking, HotelTenant, HotelMenuItem, HotelOrder, HotelServiceRequest,
      HotelChain, HotelParkingSpot, HotelFinancialRecord,
      HotelInventoryItem, HotelStaff, HotelChannel,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    RoomsService, GuestsService, BookingsService,
    MenuItemsService, OrdersService, ServiceRequestsService,
    TenantsService, HotelChainService, HotelGateway,
    HotelInventoryService, HotelStaffService, HotelChannelsService,
    HotelFrontDeskService,
  ],
  controllers: [HotelController, PublicHotelController, HotelExtrasController, HotelFrontDeskController],
})
export class HotelModule {}
