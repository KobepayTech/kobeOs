import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSettings } from './store-settings.entity';
import { IndustryTemplate, StoreCollection, StoreHomepageSection } from './storefront.entity';
import { PosProduct } from '../pos/pos.entity';
import { StoreSettingsService } from './store-settings.service';
import { StoreSettingsController } from './store-settings.controller';
import { PublishService } from './publish.service';
import { StorefrontService } from './storefront.service';
import { StorefrontController, StorefrontPublicController } from './storefront.controller';
import { CloudflareService } from '../store-registry/cloudflare.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoreSettings,
      IndustryTemplate,
      StoreCollection,
      StoreHomepageSection,
      PosProduct,
    ]),
  ],
  providers: [StoreSettingsService, PublishService, StorefrontService, CloudflareService],
  controllers: [StoreSettingsController, StorefrontController, StorefrontPublicController],
  exports: [StoreSettingsService, PublishService, StorefrontService, TypeOrmModule],
})
export class StoreSettingsModule {}
