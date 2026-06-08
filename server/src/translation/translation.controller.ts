import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TranslationService, type NllbLang } from './translation.service';

interface TranslateDto {
  text: string;
  source: NllbLang;
  target: NllbLang;
}

interface TranslateManyDto {
  texts: string[];
  source: NllbLang;
  target: NllbLang;
}

@ApiTags('Translation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('translation')
export class TranslationController {
  constructor(private readonly translation: TranslationService) {}

  @Get('languages')
  @ApiOperation({ summary: 'List supported NLLB-200 languages' })
  languages() {
    return { languages: TranslationService.LANGUAGES };
  }

  @Post('translate')
  @ApiOperation({ summary: 'Translate one string from source → target' })
  async translate(@Body() dto: TranslateDto) {
    if (!dto?.text) throw new BadRequestException('text is required');
    if (!dto.source || !dto.target) throw new BadRequestException('source and target language codes are required');
    const translation = await this.translation.translate(dto.text, dto.source, dto.target);
    return { translation, source: dto.source, target: dto.target };
  }

  @Post('translate-many')
  @ApiOperation({ summary: 'Translate an array of strings in one call' })
  async translateMany(@Body() dto: TranslateManyDto) {
    if (!Array.isArray(dto?.texts)) throw new BadRequestException('texts array is required');
    if (!dto.source || !dto.target) throw new BadRequestException('source and target language codes are required');
    const translations = await this.translation.translateMany(dto.texts, dto.source, dto.target);
    return { translations, source: dto.source, target: dto.target };
  }
}
