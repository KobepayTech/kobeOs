import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrderFromImageService, ParseResult } from './order-from-image.service';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB; raw phone photos are ~3-5MB.

/**
 * POST /api/order-from-image/parse — accepts an annotated catalog photo
 * (multipart "image" field), runs vision-AI + OCR, returns a list of
 * candidate items the operator can review before turning into a POS order.
 *
 * No DB persistence here: the parse is synchronous and the operator
 * either confirms (and we hit /pos/orders) or discards. Storing every
 * "we tried to parse this" attempt would clutter the schema for little
 * gain.
 */
@UseGuards(JwtAuthGuard)
@Controller('order-from-image')
export class OrderFromImageController {
  constructor(private readonly svc: OrderFromImageService) {}

  @Post('parse')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async parse(
    @CurrentUser('id') uid: string,
    @UploadedFile() image?: UploadedImage,
  ): Promise<ParseResult & { receivedBytes: number }> {
    if (!image) throw new BadRequestException('No image uploaded (field name: "image")');
    if (!image.mimetype?.startsWith('image/')) {
      throw new BadRequestException(`Unsupported file type: ${image.mimetype}`);
    }
    const result = await this.svc.parseImage(uid, image.buffer);
    return { ...result, receivedBytes: image.size };
  }
}
