import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelBooking, HotelGuest, HotelRoom, HotelTenant } from '../hotel/hotel.entity';
import { PlatformModule } from '../platform/platform.module';
import { LALA_ENTITIES } from './lala.entity';
import { LalaController, LalaPublicController } from './lala.controller';
import { LalaService } from './lala.service';

@Module({
  imports: [TypeOrmModule.forFeature([...LALA_ENTITIES, HotelTenant, HotelRoom, HotelBooking, HotelGuest]), PlatformModule],
  controllers: [LalaController, LalaPublicController], providers: [LalaService], exports: [LalaService],
})
export class LalaModule {}
