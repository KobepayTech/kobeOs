import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { Creator } from '../creators/creator.entity';
import { AccountantModule } from '../accountant/accountant.module';
import { CREATOR_COMMERCE_ENTITIES } from './creator-commerce.entity';
import { CreatorCommerceService } from './creator-commerce.service';
import { CreatorCommerceController, CreatorLinkPublicController } from './creator-commerce.controller';

/**
 * Creator commerce attribution: shareable creator links → click tracking →
 * order attribution → sales-based commission. Exports CreatorCommerceService so
 * the commerce (Jumla) and creators modules can attribute orders and spawn
 * links without duplicating the ledger.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...CREATOR_COMMERCE_ENTITIES, Creator]), PlatformModule, AccountantModule],
  providers: [CreatorCommerceService],
  controllers: [CreatorCommerceController, CreatorLinkPublicController],
  exports: [CreatorCommerceService],
})
export class CreatorCommerceModule {}
