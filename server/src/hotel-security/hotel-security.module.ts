import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelRoomSignalLink } from './hotel-room-link.entity';
import { HotelRoomReview } from './hotel-room-review.entity';
import {
  HotelRoomEntryEvent,
  HotelRoomPresenceState,
  HotelStaffBadgeScan,
} from './hotel-room-entry.entity';
import { HotelBooking } from '../hotel/hotel.entity';
import { HotelSecurityController } from './hotel-security.controller';
import { HotelRoomReviewsService, HotelRoomSignalLinksService, HotelSecurityDashboardService } from './hotel-security.service';
import { RoomEntryService } from './room-entry.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    HotelRoomSignalLink,
    HotelRoomReview,
    HotelRoomEntryEvent,
    HotelRoomPresenceState,
    HotelStaffBadgeScan,
    HotelBooking,
  ])],
  controllers: [HotelSecurityController],
  providers: [
    HotelRoomSignalLinksService,
    HotelRoomReviewsService,
    HotelSecurityDashboardService,
    RoomEntryService,
  ],
  exports: [RoomEntryService],
})
export class HotelSecurityModule {}
