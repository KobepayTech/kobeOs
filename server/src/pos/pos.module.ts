import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { OrdersService, ProductsService } from './pos.service';
import { PosController } from './pos.controller';
import { ReceiptService } from './receipt.service';
import { WarehouseModule } from '../warehouse/warehouse.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosProduct, PosOrder, PosOrderItem]),
    WarehouseModule,
  ],
  providers: [ProductsService, OrdersService, ReceiptService],
  controllers: [PosController],
})
export class PosModule {}
