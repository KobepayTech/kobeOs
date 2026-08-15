import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { LiveSession, LivePin, LiveComment } from './live-sale.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { LiveSaleService } from './live-sale.service';
import { LiveSaleController, LiveSaleIngestController, LiveSalePublicController, LiveSaleInstagramPublicController } from './live-sale.controller';
import { PalmPesaService } from '../creators/palmpesa.service';
import { ApifyService } from './apify.service';
import { PosModule } from '../pos/pos.module';
import { SocialAccount } from '../social-scheduler/social-account.entity';
import { InstagramService } from './instagram.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LiveSession, LivePin, LiveComment, PosProduct, PosOrder, StoreSettings, SocialAccount]),
    ConfigModule,
    PosModule, // provides OrdersService (atomic stock decrement)
  ],
  providers: [LiveSaleService, InstagramService, PalmPesaService, ApifyService],
  controllers: [LiveSaleController, LiveSaleIngestController, LiveSalePublicController, LiveSaleInstagramPublicController],
  exports: [LiveSaleService],
})
export class LiveSaleModule {}
