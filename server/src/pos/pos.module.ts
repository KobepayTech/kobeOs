import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { OrdersService, ProductsService } from './pos.service';
import { PosController } from './pos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PosProduct, PosOrder, PosOrderItem])],
  providers: [ProductsService, OrdersService],
  controllers: [PosController],
})
export class PosModule {}
