import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudOutboxRecord, CloudRoomAllotment } from './continuity.entity';
import { ProductSnippet } from '../commerce/commerce.entity';
import { HotelBooking, HotelGuest, HotelRoom } from '../hotel/hotel.entity';
import { ContinuityService } from './continuity.service';

/**
 * Exports ContinuityService alone: the front desk and POS import this module
 * to ask whether capacity is spoken for, and nothing else needs the entities.
 */
@Module({
  imports: [TypeOrmModule.forFeature([
    CloudRoomAllotment,
    CloudOutboxRecord,
    ProductSnippet,
    HotelBooking,
    HotelGuest,
    HotelRoom,
  ])],
  providers: [ContinuityService],
  exports: [ContinuityService],
})
export class ContinuityModule {}
