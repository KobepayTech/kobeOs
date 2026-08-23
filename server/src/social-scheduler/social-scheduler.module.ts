import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module';
import { SocialPost } from './social-post.entity';
import { SocialAccount } from './social-account.entity';
import { SocialSchedulerService } from './social-scheduler.service';
import { SocialSchedulerController } from './social-scheduler.controller';
import { TikTokController, TikTokPublicController } from './tiktok.controller';
import { TikTokService } from './tiktok.service';

@Module({
  imports: [TypeOrmModule.forFeature([SocialPost, SocialAccount]), MediaModule],
  providers: [SocialSchedulerService, TikTokService],
  controllers: [SocialSchedulerController, TikTokController, TikTokPublicController],
  exports: [SocialSchedulerService, TikTokService],
})
export class SocialSchedulerModule {}
