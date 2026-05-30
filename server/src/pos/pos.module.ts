import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { OrdersService, ProductsService } from './pos.service';
import { PosController } from './pos.controller';
import { ReceiptService } from './receipt.service';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { DiscountsModule } from '../discounts/discount.module';
import { CreditModule } from '../credit/credit.module';
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosProduct, PosOrder, PosOrderItem]),
    WarehouseModule,
    DiscountsModule,
    CreditModule,
    ErpModule,
  ],
  providers: [ProductsService, OrdersService, ReceiptService],
  controllers: [PosController],
})
export class PosModule {}
