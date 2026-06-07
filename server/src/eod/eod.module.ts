import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopCashCount, ShopExpense } from './eod.entity';
import { PosOrder } from '../pos/pos.entity';
import { EodService } from './eod.service';
import { EodController } from './eod.controller';
import { ShopsModule } from '../shops/shops.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopExpense, ShopCashCount, PosOrder]),
    ShopsModule,
  ],
  providers: [EodService],
  controllers: [EodController],
  exports: [EodService],
})
export class EodModule {}
