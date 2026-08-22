import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundPayment, SmsDevice } from './mobile-money.entity';
import { MobileMoneyService } from './mobile-money.service';
import { MobileMoneyController, MobileMoneyPublicController } from './mobile-money.controller';

/**
 * Shared mobile-money / bank SMS bridge. Any module can consume forwarded
 * transactions by injecting MobileMoneyService and calling registerConsumer().
 */
@Module({
  imports: [TypeOrmModule.forFeature([SmsDevice, InboundPayment])],
  providers: [MobileMoneyService],
  controllers: [MobileMoneyPublicController, MobileMoneyController],
  exports: [MobileMoneyService],
})
export class MobileMoneyModule {}
