import {
  BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch,
  Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FilesService } from './files.service';
import { CreateNodeDto, MoveNodeDto, UpdateNodeDto } from './dto/file.dto';

interface UploadedFileShape {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Get()
  list(@CurrentUser('id') uid: string, @Query('parent') parent?: string) {
    return this.svc.list(uid, parent ?? '/');
  }

  @Get('node')
  get(@CurrentUser('id') uid: string, @Query('path') path: string) {
    return this.svc.get(uid, path);
  }

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateNodeDto) {
    return this.svc.create(uid, dto);
  }

  /**
   * Multipart upload: writes raw bytes to `path`. Use `?path=/folder/file.ext`
   * and a `file` form field. Creates the row on first call, overwrites on
   * subsequent calls to the same path.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @CurrentUser('id') uid: string,
    @Query('path') path: string,
    @UploadedFile() file: UploadedFileShape | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!path) throw new BadRequestException('Missing ?path');
    return this.svc.upload(uid, path, file);
  }

  @Get('blob')
  @Header('Cache-Control', 'private, max-age=300')
  async blob(
    @CurrentUser('id') uid: string,
    @Query('path') path: string,
    @Res() res: Response,
  ) {
    const node = await this.svc.readBlob(uid, path);
    res.setHeader('Content-Type', node.mimeType ?? 'application/octet-stream');
    if (node.contentBinary) {
      res.setHeader('Content-Length', String(node.size));
      res.end(node.contentBinary);
    } else {
      res.setHeader('Content-Length', String((node.content ?? '').length));
      res.end(node.content ?? '');
    }
  }

  @Patch('node')
  update(@CurrentUser('id') uid: string, @Query('path') path: string, @Body() dto: UpdateNodeDto) {
    return this.svc.update(uid, path, dto);
  }

  @Put('move')
  move(@CurrentUser('id') uid: string, @Query('path') path: string, @Body() dto: MoveNodeDto) {
    return this.svc.move(uid, path, dto);
  }

  @Delete('node')
  remove(@CurrentUser('id') uid: string, @Query('path') path: string) {
    return this.svc.remove(uid, path);
  }
}
