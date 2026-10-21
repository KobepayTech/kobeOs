import { LalaIdentityService } from './lala-identity.service';
import { LalaPhoneChallenge } from './lala-phone-challenge.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelBooking, HotelGuest, HotelRoom, HotelTenant } from '../hotel/hotel.entity';
import { PlatformModule } from '../platform/platform.module';
import { LALA_ENTITIES } from './lala.entity';
import { LalaController, LalaPublicController } from './lala.controller';
import { LalaService } from './lala.service';

@Module({
  imports: [NotificationsModule, TypeOrmModule.forFeature([LalaPhoneChallenge, ...LALA_ENTITIES, HotelTenant, HotelRoom, HotelBooking, HotelGuest]), PlatformModule],
  controllers: [LalaController, LalaPublicController], providers: [LalaService, LalaIdentityService], exports: [LalaService],
})
export class LalaModule {}
