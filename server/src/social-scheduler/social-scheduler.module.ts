import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module';
import { SocialPost } from './social-post.entity';
import { SocialAccount } from './social-account.entity';
import { SocialSchedulerService } from './social-scheduler.service';
import { SocialSchedulerController } from './social-scheduler.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SocialPost, SocialAccount]), MediaModule],
  providers: [SocialSchedulerService],
  controllers: [SocialSchedulerController],
  exports: [SocialSchedulerService],
})
export class SocialSchedulerModule {}
