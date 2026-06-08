import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OcrService } from './ocr.service';

interface ExtractBase64Dto {
  image: string;
  lang?: string;
}

@ApiTags('OCR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Get('languages')
  @ApiOperation({ summary: 'List languages with bundled traineddata' })
  languages() {
    return { languages: OcrService.SUPPORTED };
  }

  @Post('extract')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Extract text from an uploaded image (multipart)' })
  async extract(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('lang') lang?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No image uploaded');
    return this.ocr.extract(file.buffer, lang || 'eng+swa');
  }

  @Post('extract-base64')
  @ApiOperation({ summary: 'Extract text from a base64-encoded image (JSON body)' })
  async extractBase64(@Body() body: ExtractBase64Dto) {
    if (!body?.image) throw new BadRequestException('image (base64) is required');
    const cleaned = body.image.replace(/^data:[^;]+;base64,/, '');
    return this.ocr.extract(Buffer.from(cleaned, 'base64'), body.lang || 'eng+swa');
  }

  @Post('extract-receipt')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 12 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Extract text + parse total / date / merchant from a receipt image' })
  async extractReceipt(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('lang') lang?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No image uploaded');
    return this.ocr.extractReceipt(file.buffer, lang || 'eng+swa');
  }
}
