import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { QrService } from './qr.service';
import { QrType } from './qr.entity';

class GenerateQrDto {
  @IsEnum(['customer', 'supplier']) type!: QrType;
  @IsString() reference!: string;
  @IsString() label!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsString() currency!: string;
  @IsOptional() meta?: Record<string, unknown>;
}

class GenerateQrPairDto {
  @IsString() reference!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsString() currency!: string;
  @IsString() customerName!: string;
  @IsString() supplierName!: string;
  @IsString() supplierNumber!: string;
  @IsOptional() @IsString() country?: string;
}

class MarkUsedDto {
  @IsString() shortCode!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('qr')
export class QrController {
  constructor(private readonly svc: QrService) {}

  /** Generate a single QR code (customer or supplier). */
  @Post()
  generate(@CurrentUser('id') uid: string, @Body() dto: GenerateQrDto) {
    return this.svc.generate({ ownerId: uid, ...dto });
  }

  /** Generate both customer + supplier QR codes for a deposit in one call. */
  @Post('pair')
  generatePair(@CurrentUser('id') uid: string, @Body() dto: GenerateQrPairDto) {
    return this.svc.generatePair({ ownerId: uid, ...dto });
  }

  /** List all QR codes owned by the current user. */
  @Get('mine')
  mine(@CurrentUser('id') uid: string) {
    return this.svc.listByOwner(uid);
  }

  /** List QR codes for a specific transaction reference. */
  @Get('by-reference/:ref')
  byReference(@CurrentUser('id') _uid: string, @Param('ref') ref: string) {
    return this.svc.listByReference(ref);
  }

  /**
   * Public short-code lookup — no auth required.
   * Used by the supplier cashier portal.
   */
  @Public()
  @Get('lookup')
  lookup(@Query('code') code: string) {
    return this.svc.lookupByShortCode(code ?? '');
  }

  /** Mark a QR code as used after cashier confirms payout. */
  @Post('mark-used')
  markUsed(@Body() dto: MarkUsedDto) {
    return this.svc.markUsed(dto.shortCode);
  }
}
