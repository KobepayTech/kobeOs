import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { ModuleSiteSettings } from '../store-settings/module-site-settings.entity';
import { HotelRoom, HotelGuest, HotelBooking } from '../hotel/hotel.entity';
import { PalmPesaModule } from '../creators/palmpesa.module';
import { HotelPublicService } from './hotel-public.service';
import { HotelPublicController } from './hotel-public.controller';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [TypeOrmModule.forFeature([
    StoreSettings,
    ModuleSiteSettings,
    HotelRoom,
    HotelGuest,
    HotelBooking,
  ]), PlatformModule, PalmPesaModule],
  providers: [HotelPublicService],
  controllers: [HotelPublicController],
})
export class HotelPublicModule {}
