import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { KobeAgentService } from './agent.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge, Tenant, PropertyUnit } from '../property/property.entity';
import { HotelRoom } from '../hotel/hotel.entity';
import { HotelFinancialRecord } from '../hotel/hotel-financials.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { ShopExpense } from '../eod/eod.entity';
import { Parcel } from '../cargo/cargo.entity';
import { Shop } from '../shops/shop.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PosOrder, PosProduct, ProductReview, RentCharge, Tenant, PropertyUnit,
      HotelRoom, HotelFinancialRecord, WarehouseItem, ShopExpense, Parcel, Shop,
    ]),
    NotificationsModule,
  ],
  providers: [AiService, KobeAgentService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
