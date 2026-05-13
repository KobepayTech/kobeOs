import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset, Playlist } from './media.entity';
import { MediaAssetsService, PlaylistsService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MediaAsset, Playlist])],
  providers: [MediaAssetsService, PlaylistsService],
  controllers: [MediaController],
})
export class MediaModule {}
