import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ShopStockAllocation,
  ShopStockEstimate,
  ShopStockReconciliation,
} from './shop-stock.entity';
import { ShopStockService } from './shop-stock.service';
import { ShopStockController } from './shop-stock.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShopStockAllocation,
      ShopStockEstimate,
      ShopStockReconciliation,
    ]),
  ],
  providers: [ShopStockService],
  controllers: [ShopStockController],
  exports: [ShopStockService],
})
export class ShopStockModule {}
