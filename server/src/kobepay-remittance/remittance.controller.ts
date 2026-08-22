import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { RemittanceService } from './remittance.service';

class CreateClaimDto {
  @IsNumber() @Min(0.0001) amount!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(120) senderName?: string;
  @IsOptional() @IsString() @MaxLength(40) senderPhone?: string;
  @IsOptional() @IsString() @MaxLength(80) recipientCountry?: string;
}

class AddSupplierDto {
  @IsNumber() @Min(0.0001) authorizedAmount!: number;
  @IsOptional() @IsString() @MaxLength(120) supplierName?: string;
  @IsOptional() @IsString() @MaxLength(40) supplierPhone?: string;
}

class RedeemDto {
  @IsNumber() @Min(0.0001) amountReceived!: number;
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
}

@ApiTags('KobePay / Remittance')
@UseGuards(JwtAuthGuard)
@Controller('remittance')
export class RemittanceController {
  constructor(private readonly svc: RemittanceService) {}

  /** Cashier company creates a claim from a receive-receipt. */
  @Post()
  @ApiOperation({ summary: 'Create a remittance claim (master QR + sender portal link)' })
  create(@CurrentUser('id') uid: string, @Body() dto: CreateClaimDto) {
    return this.svc.createClaim(uid, dto);
  }

  /** Owner adds a supplier QR to a claim. */
  @Post(':claimId/suppliers')
  @ApiOperation({ summary: 'Add a fixed-amount supplier QR to a claim' })
  addSupplier(@CurrentUser('id') uid: string, @Param('claimId') claimId: string, @Body() dto: AddSupplierDto) {
    return this.svc.addSupplier(uid, claimId, dto);
  }

  /** Cashier cashes out against a scanned code (master or supplier QR). */
  @Post('redeem/:code')
  @ApiOperation({ summary: 'Cash out against a scanned QR code (shared-balance, atomic)' })
  redeem(@CurrentUser('id') uid: string, @Param('code') code: string, @Body() dto: RedeemDto) {
    return this.svc.redeem(code.trim().toUpperCase(), { ...dto, cashierId: uid });
  }

  // ── Public (bearer: secret portal token / QR code) ──────────────────────────

  /** Sender's live-balance portal (secret token). */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('portal/:portalToken')
  @ApiOperation({ summary: 'Sender live balance + suppliers + payouts' })
  portal(@Param('portalToken') portalToken: string) {
    return this.svc.portal(portalToken);
  }

  /** Sender adds a supplier from their portal (authorised by the portal token). */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('portal/:portalToken/suppliers')
  @ApiOperation({ summary: 'Sender adds a supplier QR from the portal' })
  addSupplierByPortal(@Param('portalToken') portalToken: string, @Body() dto: AddSupplierDto) {
    return this.svc.addSupplierByPortal(portalToken, dto);
  }

  /** Cashier scans a code to see what's payable now. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('lookup/:code')
  @ApiOperation({ summary: 'What a scanned QR (master or supplier) can pay out now' })
  lookup(@Param('code') code: string) {
    return this.svc.lookup(code.trim().toUpperCase());
  }
}
