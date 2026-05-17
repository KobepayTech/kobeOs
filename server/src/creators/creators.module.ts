import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from './creator.entity';
import { Campaign } from './campaign.entity';
import { CreatorEscrow } from './escrow.entity';
import { CreatorSubscription } from './creator-subscription.entity';
import { Wallet, PaymentTransaction } from '../payments/payments.entity';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { ScrapeCreatorsService } from './scrape-creators.service';
import { CampaignService } from './campaign.service';
import { EscrowService } from './escrow.service';
import { MetricsEngineService } from './metrics-engine.service';
import { CreatorsCronService } from './creators-cron.service';
import { PalmPesaService } from './palmpesa.service';
import { CreatorSubscriptionService } from './creator-subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Creator, Campaign, CreatorEscrow, CreatorSubscription,
      Wallet, PaymentTransaction,
    ]),
  ],
  providers: [
    ScrapeCreatorsService,
    PalmPesaService,
    MetricsEngineService,
    CreatorsService,
    CampaignService,
    EscrowService,
    CreatorsCronService,
    CreatorSubscriptionService,
  ],
  controllers: [CreatorsController],
  exports: [
    CreatorsService, CampaignService, EscrowService,
    MetricsEngineService, CreatorSubscriptionService,
  ],
})
export class CreatorsModule {}
