import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { HotelRoom, HotelGuest, HotelBooking } from '../hotel/hotel.entity';
import { HotelPublicService } from './hotel-public.service';
import { HotelPublicController } from './hotel-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StoreSettings, HotelRoom, HotelGuest, HotelBooking])],
  providers: [HotelPublicService],
  controllers: [HotelPublicController],
})
export class HotelPublicModule {}
