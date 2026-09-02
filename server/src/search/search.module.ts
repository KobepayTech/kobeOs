import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchDoc } from './search.entity';
import { PosProduct } from '../pos/pos.entity';
import { Tenant } from '../property/property.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge } from '../property/property.entity';
import { HotelBooking, HotelRoom } from '../hotel/hotel.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { ShopExpense } from '../eod/eod.entity';
import { Parcel } from '../cargo/cargo.entity';
import { AiModule } from '../ai/ai.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SearchDoc, PosProduct, Tenant, ProductReview, RentCharge, HotelRoom, HotelBooking,
      WarehouseItem, ShopExpense, Parcel,
    ]),
    AiModule,
  ],
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
