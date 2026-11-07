import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudOutboxRecord, CloudRoomAllotment } from './continuity.entity';
import { CommerceProductMedia, ProductSnippet } from '../commerce/commerce.entity';
import { HotelBooking, HotelGuest, HotelRoom, HotelTenant } from '../hotel/hotel.entity';
import { ContinuityService } from './continuity.service';
import { ContinuitySyncService } from './continuity-sync.service';
import { ContinuitySyncController } from './continuity-sync.controller';
import { ContinuitySyncWorker } from './continuity-sync.worker';
import { SyncTokenGuard } from './sync-token.guard';

/**
 * Exports ContinuityService alone: the front desk and POS import this module
 * to ask whether capacity is spoken for, and nothing else needs the entities.
 */
@Module({
  imports: [TypeOrmModule.forFeature([
    CloudRoomAllotment,
    CloudOutboxRecord,
    ProductSnippet,
    CommerceProductMedia,
    HotelBooking,
    HotelGuest,
    HotelRoom,
    HotelTenant,
  ])],
  controllers: [ContinuitySyncController],
  providers: [ContinuityService, ContinuitySyncService, ContinuitySyncWorker, SyncTokenGuard],
  exports: [ContinuityService, ContinuitySyncService],
})
export class ContinuityModule {}
