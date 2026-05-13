import {
  BadRequestException,
  Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MediaAssetsService, PlaylistsService } from './media.service';
import { CreateAssetDto, CreatePlaylistDto, UpdateAssetDto, UpdatePlaylistDto } from './dto/media.dto';
import { MediaAsset } from './media.entity';

interface UploadedFileShape {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

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

  @Post('assets')
  createAsset(@CurrentUser('id') uid: string, @Body() dto: CreateAssetDto) {
    return this.assets.create(uid, dto);
  }

  /**
   * Real multipart upload — accepts a binary file and stores the bytes
   * inline on the asset. The returned `src` points at /api/media/blob/:id.
   * Kind defaults to "audio" but can be overridden via the kind query param.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadAsset(
    @CurrentUser('id') uid: string,
    @UploadedFile() file: UploadedFileShape | undefined,
    @Query('kind') kind?: MediaAsset['kind'],
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed: MediaAsset['kind'][] = ['photo', 'audio', 'video', 'image'];
    const safeKind: MediaAsset['kind'] = kind && allowed.includes(kind) ? kind : 'audio';
    return this.assets.createFromUpload(uid, file, safeKind);
  }

  @Get('blob/:id')
  @Header('Cache-Control', 'private, max-age=3600')
  async getBlob(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const asset = await this.assets.getBlob(uid, id);
    res.setHeader('Content-Type', asset.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(asset.size));
    res.end(asset.contentBinary);
  }

  @Patch('assets/:id') updateAsset(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateAssetDto) { return this.assets.update(uid, id, dto); }
  @Delete('assets/:id') removeAsset(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.assets.remove(uid, id); }

  @Get('playlists') listPlaylists(@CurrentUser('id') uid: string) { return this.playlists.list(uid); }
  @Post('playlists') createPlaylist(@CurrentUser('id') uid: string, @Body() dto: CreatePlaylistDto) { return this.playlists.create(uid, dto); }
  @Patch('playlists/:id') updatePlaylist(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePlaylistDto) { return this.playlists.update(uid, id, dto); }
  @Delete('playlists/:id') removePlaylist(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.playlists.remove(uid, id); }
}
