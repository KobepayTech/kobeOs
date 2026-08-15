import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  ImportUrlsDto,
  ProcessMediaInboxDto,
  SuggestMediaMetadataDto,
  UpdateMediaInboxItemDto,
} from './dto/media-inbox.dto';
import { MediaInboxService } from './media-inbox.service';
import type { MediaInboxStatus } from './media-inbox.entity';

@UseGuards(JwtAuthGuard)
@Controller('media/inbox')
export class MediaInboxController {
  constructor(private readonly service: MediaInboxService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 100, {
    storage: memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024, files: 100 }, // 100MB — accommodates short videos
    fileFilter: (_request, file, callback) => {
      const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
      callback(ok ? null : new Error('Only image or video files are allowed'), ok);
    },
  }))
  upload(
    @CurrentUser('id') ownerId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.upload(ownerId, files ?? []);
  }

  /** Bulk-add by pasting a list of image/video links (Drive or any host). */
  @Post('import-urls')
  importUrls(@CurrentUser('id') ownerId: string, @Body() dto: ImportUrlsDto) {
    return this.service.importFromUrls(ownerId, dto.urls);
  }

  @Get()
  list(
    @CurrentUser('id') ownerId: string,
    @Query('status') status?: MediaInboxStatus,
    @Query('moduleId') moduleId?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list(ownerId, { status, moduleId, q });
  }

  @Patch(':id')
  update(
    @CurrentUser('id') ownerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMediaInboxItemDto,
  ) {
    return this.service.update(ownerId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.service.remove(ownerId, id);
  }

  @Post('suggest')
  suggest(@CurrentUser('id') ownerId: string, @Body() dto: SuggestMediaMetadataDto) {
    return this.service.suggest(ownerId, dto);
  }

  @Post('process')
  process(@CurrentUser('id') ownerId: string, @Body() dto: ProcessMediaInboxDto) {
    return this.service.process(ownerId, dto);
  }

  /** One-tap: turn every unprocessed image into a generic, published product. */
  @Post('generate-products')
  generateProducts(
    @CurrentUser('id') ownerId: string,
    @Body() dto: { category?: string; includeFailed?: boolean; sourceType?: 'QUICK_ADD_PHOTO' | 'QUICK_ADD_SCREENSHOT' | 'QUICK_ADD_MESSAGE' | 'QUICK_ADD_IMPORT' },
  ) {
    return this.service.generateGenericProducts(ownerId, dto ?? {});
  }
}
