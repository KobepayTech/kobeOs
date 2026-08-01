import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsModule } from '../creators/creators.module';
import { AppEntitlement } from './app-entitlement.entity';
import { AppMarketplaceController } from './app-marketplace.controller';
import { AppMarketplaceService } from './app-marketplace.service';
import { PayPalCheckoutService } from './paypal-checkout.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppEntitlement]),
    CreatorsModule,
  ],
  controllers: [AppMarketplaceController],
  providers: [AppMarketplaceService, PayPalCheckoutService],
  exports: [AppMarketplaceService],
})
export class AppMarketplaceModule {}
