import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageEditService } from './image-edit.service';

@ApiTags('Image edit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('image-edit')
export class ImageEditController {
  constructor(private readonly imageEdit: ImageEditService) {}

  @Post('remove-background')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @Header('content-type', 'image/png')
  @ApiOperation({ summary: 'Remove the background; returns a PNG with alpha. Pass ?model=Xenova/u2net for strict MIT model.' })
  async removeBackground(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('model') model: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    if (!file?.buffer?.length) throw new BadRequestException('No image uploaded');
    const which = (model === 'Xenova/u2net' ? 'Xenova/u2net' : 'briaai/RMBG-1.4') as 'briaai/RMBG-1.4' | 'Xenova/u2net';
    const out = await this.imageEdit.removeBackground(file.buffer, which);
    res.setHeader('content-length', out.length);
    return out;
  }
}
