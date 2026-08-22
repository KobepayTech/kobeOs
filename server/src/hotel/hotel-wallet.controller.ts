import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HotelWalletService } from './hotel-wallet.service';
import { HotelPayoutStatus } from './hotel-wallet.entity';

class RequestPayoutBody {
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsIn(['MobileMoney', 'Bank', 'Cash', 'Other']) method?: 'MobileMoney' | 'Bank' | 'Cash' | 'Other';
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() requestedByName?: string;
}

class SetPayoutStatusBody {
  @IsIn(['PAID', 'FAILED']) status!: HotelPayoutStatus;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() processedByName?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('hotel/wallet')
export class HotelWalletController {
  constructor(private readonly wallet: HotelWalletService) {}

  /** This hotel's balance, recent ledger, and pending payouts. */
  @Get()
  summary(@CurrentUser('id') uid: string) {
    return this.wallet.summary(uid);
  }

  @Get('transactions')
  txns(@CurrentUser('id') uid: string, @Query('limit') limit?: string) {
    return this.wallet.listTxns(uid, limit ? parseInt(limit, 10) : 200);
  }

  @Get('payouts')
  payouts(@CurrentUser('id') uid: string) {
    return this.wallet.listPayouts(uid);
  }

  /** Hotel requests a disbursement of its balance. */
  @Post('payouts')
  requestPayout(@CurrentUser('id') uid: string, @Body() dto: RequestPayoutBody) {
    return this.wallet.requestPayout(uid, dto, dto.requestedByName ?? '');
  }

  /** Mark a payout PAID or FAILED (settles or refunds the reserved funds). */
  @Patch('payouts/:id/status')
  setStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: SetPayoutStatusBody) {
    return this.wallet.setPayoutStatus(uid, id, dto.status, dto.processedByName ?? '', dto.reference ?? '');
  }

  /** Platform-wide overview across all hotels (balances owed, pending payouts). */
  @Get('platform/overview')
  overview() {
    return this.wallet.platformOverview();
  }
}
