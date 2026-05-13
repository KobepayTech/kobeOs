import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MediaAssetsService, PlaylistsService } from './media.service';
import { CreateAssetDto, CreatePlaylistDto, UpdateAssetDto, UpdatePlaylistDto } from './dto/media.dto';
import { MediaAsset } from './media.entity';

@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(
    private readonly assets: MediaAssetsService,
    private readonly playlists: PlaylistsService,
  ) {}

  @Get('assets')
  listAssets(@CurrentUser('id') uid: string, @Query('kind') kind?: MediaAsset['kind']) {
    return kind ? this.assets.listByKind(uid, kind) : this.assets.list(uid);
  }
  @Post('assets') createAsset(@CurrentUser('id') uid: string, @Body() dto: CreateAssetDto) { return this.assets.create(uid, dto); }
  @Patch('assets/:id') updateAsset(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateAssetDto) { return this.assets.update(uid, id, dto); }
  @Delete('assets/:id') removeAsset(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.assets.remove(uid, id); }

  @Get('playlists') listPlaylists(@CurrentUser('id') uid: string) { return this.playlists.list(uid); }
  @Post('playlists') createPlaylist(@CurrentUser('id') uid: string, @Body() dto: CreatePlaylistDto) { return this.playlists.create(uid, dto); }
  @Patch('playlists/:id') updatePlaylist(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePlaylistDto) { return this.playlists.update(uid, id, dto); }
  @Delete('playlists/:id') removePlaylist(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.playlists.remove(uid, id); }
}
