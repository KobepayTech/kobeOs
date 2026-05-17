import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from './creator.entity';
import { Campaign } from './campaign.entity';
import { CreatorEscrow } from './escrow.entity';
import { Wallet, PaymentTransaction } from '../payments/payments.entity';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { ScrapeCreatorsService } from './scrape-creators.service';
import { CampaignService } from './campaign.service';
import { EscrowService } from './escrow.service';
import { MetricsEngineService } from './metrics-engine.service';
import { CreatorsCronService } from './creators-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Creator, Campaign, CreatorEscrow, Wallet, PaymentTransaction]),
  ],
  providers: [
    ScrapeCreatorsService,
    MetricsEngineService,
    CreatorsService,
    CampaignService,
    EscrowService,
    CreatorsCronService,
  ],
  controllers: [CreatorsController],
  exports: [CreatorsService, CampaignService, EscrowService, MetricsEngineService],
})
export class CreatorsModule {}
