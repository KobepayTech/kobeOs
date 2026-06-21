import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { OrdersService, ProductsService } from './pos.service';
import { PosController } from './pos.controller';
import { ReceiptService } from './receipt.service';
import { PosGateway } from './pos.gateway';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { DiscountsModule } from '../discounts/discount.module';
import { CreditModule } from '../credit/credit.module';
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosProduct, PosOrder, PosOrderItem]),
    // Gateway uses JwtModule for socket authentication (same secret
    // as the HTTP JwtAuthGuard).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    WarehouseModule,
    DiscountsModule,
    CreditModule,
    ErpModule,
  ],
  providers: [ProductsService, OrdersService, ReceiptService, PosGateway],
  controllers: [PosController],
  exports: [OrdersService],
})
export class PosModule {}
