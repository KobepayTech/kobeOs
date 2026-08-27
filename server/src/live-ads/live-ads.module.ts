import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { Creator } from '../creators/creator.entity';
import { LIVE_ADS_ENTITIES } from './live-ads.entity';
import { LiveAdsService } from './live-ads.service';
import { LiveAdsController, LiveAdsPublicController } from './live-ads.controller';

/**
 * Kobe Live Ads — permanent-link LIVE performance-ad network. The creator's
 * kobe.live/@handle URL is fixed forever; the sponsor behind it changes with
 * live session + campaign state. Kobe owns the attribution funnel end-to-end.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...LIVE_ADS_ENTITIES, Creator]), PlatformModule],
  providers: [LiveAdsService],
  controllers: [LiveAdsController, LiveAdsPublicController],
  exports: [LiveAdsService],
})
export class LiveAdsModule {}
