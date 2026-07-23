import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { PosProduct } from '../pos/pos.entity';
import { MediaAsset } from './media.entity';
import { MediaInboxItem } from './media-inbox.entity';
import { MediaInboxController } from './media-inbox.controller';
import { MediaInboxService } from './media-inbox.service';
import { MediaModule } from './media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset, MediaInboxItem, PosProduct]),
    MediaModule,
    AiModule,
  ],
  controllers: [MediaInboxController],
  providers: [MediaInboxService],
  exports: [MediaInboxService],
})
export class MediaInboxModule {}
