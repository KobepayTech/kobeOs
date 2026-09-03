import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset, Playlist } from './media.entity';
import { MediaAssetsService, PlaylistsService } from './media.service';
import { MediaController, MediaPublicTokenController, PublicMediaController } from './media.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset, Playlist])],
  providers: [MediaAssetsService, PlaylistsService],
  exports: [MediaAssetsService, PlaylistsService],
  controllers: [MediaController, MediaPublicTokenController, PublicMediaController],
})
export class MediaModule {}
