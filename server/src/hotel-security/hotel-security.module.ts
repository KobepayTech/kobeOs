import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelRoomSignalLink } from './hotel-room-link.entity';
import { HotelRoomReview } from './hotel-room-review.entity';
import { HotelSecurityController } from './hotel-security.controller';
import { HotelRoomReviewsService, HotelRoomSignalLinksService, HotelSecurityDashboardService } from './hotel-security.service';

@Module({
  imports: [TypeOrmModule.forFeature([HotelRoomSignalLink, HotelRoomReview])],
  controllers: [HotelSecurityController],
  providers: [HotelRoomSignalLinksService, HotelRoomReviewsService, HotelSecurityDashboardService],
})
export class HotelSecurityModule {}
