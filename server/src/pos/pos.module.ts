import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PosOrder, PosOrderItem, PosProduct } from './pos.entity';
import { OrdersService, ProductsService } from './pos.service';
import { ReorderService } from './reorder.service';
import { PosController } from './pos.controller';
import { ReceiptService } from './receipt.service';
import { PosGateway } from './pos.gateway';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { DiscountsModule } from '../discounts/discount.module';
import { CreditModule } from '../credit/credit.module';
import { ErpModule } from '../erp/erp.module';
import { AuthModule } from '../auth/auth.module';
import { PalmPesaModule } from '../creators/palmpesa.module';
import { SocialCheckoutPaymentsController } from './social-checkout-payments.controller';
import { SocialCheckoutPaymentsService } from './social-checkout-payments.service';
import { BodaRider } from './boda-rider.entity';
import { BodaRiderController } from './boda-rider.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    PalmPesaModule,
    TypeOrmModule.forFeature([PosProduct, PosOrder, PosOrderItem, BodaRider]),
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
    // Needed by the POS inline manager-approve endpoint, which calls
    // AuthService.verifyManager to bcrypt-compare without issuing JWTs.
    AuthModule,
  ],
  providers: [ProductsService, OrdersService, ReceiptService, PosGateway, ReorderService, SocialCheckoutPaymentsService],
  controllers: [BodaRiderController, PosController, SocialCheckoutPaymentsController],
  exports: [OrdersService, SocialCheckoutPaymentsService],
})
export class PosModule {}
