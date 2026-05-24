import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ErpAccount, ErpTransaction, LoyaltyCustomer, LoyaltyPointsEntry, LoyaltyReward,
  PurchaseOrder, Supplier,
} from './erp.entity';
import {
  AccountsService, LoyaltyCustomersService, PointsService, PurchaseOrdersService,
  RewardsService, SuppliersService, TransactionsService,
} from './erp.service';
import { ErpSummaryService } from './erp.summary.service';
import { ErpController } from './erp.controller';
import { PosOrder, PosOrderItem, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpAccount, ErpTransaction, LoyaltyCustomer, LoyaltyReward, LoyaltyPointsEntry,
      Supplier, PurchaseOrder,
      // read-only sources for the summary rollup
      PosOrder, PosOrderItem, PosProduct, WarehouseItem,
    ]),
  ],
  providers: [
    AccountsService, TransactionsService, LoyaltyCustomersService, RewardsService,
    PointsService, SuppliersService, PurchaseOrdersService, ErpSummaryService,
  ],
  controllers: [ErpController],
})
export class ErpModule {}
