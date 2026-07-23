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
    limits: { fileSize: 15 * 1024 * 1024, files: 100 },
    fileFilter: (_request, file, callback) => {
      callback(file.mimetype.startsWith('image/') ? null : new Error('Only image files are allowed'), file.mimetype.startsWith('image/'));
    },
  }))
  upload(
    @CurrentUser('id') ownerId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.upload(ownerId, files ?? []);
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
}
