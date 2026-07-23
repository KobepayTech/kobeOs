import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ScheduledAgentController } from './scheduled-agent.controller';
import { KobeAgentService } from './agent.service';
import { AiMemory } from './ai-memory.entity';
import { ScheduledAgentService } from './scheduled-agent.service';
import { AiAgentRun, AiScheduledAgent } from './scheduled-agent.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge, Tenant, PropertyUnit } from '../property/property.entity';
import { HotelRoom, HotelGuest, HotelBooking } from '../hotel/hotel.entity';
import { HotelFinancialRecord } from '../hotel/hotel-financials.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { ShopExpense } from '../eod/eod.entity';
import { Parcel } from '../cargo/cargo.entity';
import { Shop } from '../shops/shop.entity';
import { AppState } from '../app-state/app-state.entity';
import { SearchDoc } from '../search/search.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PosOrder, PosProduct, ProductReview, RentCharge, Tenant, PropertyUnit,
      HotelRoom, HotelGuest, HotelBooking, HotelFinancialRecord, WarehouseItem,
      ShopExpense, Parcel, Shop, AppState, SearchDoc, AiScheduledAgent, AiAgentRun, AiMemory,
    ]),
    NotificationsModule,
  ],
  providers: [AiService, KobeAgentService, ScheduledAgentService],
  controllers: [AiController, ScheduledAgentController],
  exports: [AiService, KobeAgentService, ScheduledAgentService],
})
export class AiModule {}
