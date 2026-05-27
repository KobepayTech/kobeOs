import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { LoansService, TransactionsService, WalletsService } from './payments.service';
import { CreateLoanDto, CreateWalletDto, TransactionDto, TransferDto, UpdateLoanDto } from './dto/payments.dto';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly wallets: WalletsService,
    private readonly txns: TransactionsService,
    private readonly loans: LoansService,
  ) {}

  /**
   * Public endpoint — no JWT required.
   * Used by the supplier cashier portal to look up a payout by short code
   * (last 4–12 chars of the transaction reference).
   * Returns only non-sensitive payout details.
   */
  @Public()
  @Get('payout-lookup')
  payoutLookup(@Query('code') code: string) {
    return this.txns.payoutLookup(code ?? '');
  }

  @Get('wallets') listWallets(@CurrentUser('id') uid: string) { return this.wallets.list(uid); }
  @Get('wallets/:id') getWallet(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.wallets.get(uid, id); }
  @Post('wallets') createWallet(@CurrentUser('id') uid: string, @Body() dto: CreateWalletDto) { return this.wallets.create(uid, dto); }

  @Get('transactions')
  listTxns(@CurrentUser('id') uid: string, @Query('walletId') walletId?: string) {
    return walletId ? this.txns.byWallet(uid, walletId) : this.txns.list(uid);
  }
  @Post('transactions') post(@CurrentUser('id') uid: string, @Body() dto: TransactionDto) { return this.txns.post(uid, dto); }
  @Post('transfer') transfer(@CurrentUser('id') uid: string, @Body() dto: TransferDto) { return this.txns.transfer(uid, dto); }

  @Get('loans') listLoans(@CurrentUser('id') uid: string) { return this.loans.list(uid); }
  @Post('loans') createLoan(@CurrentUser('id') uid: string, @Body() dto: CreateLoanDto) { return this.loans.createLoan(uid, dto); }
  @Patch('loans/:id') updateLoan(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateLoanDto) { return this.loans.updateLoan(uid, id, dto); }
  @Delete('loans/:id') removeLoan(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.loans.remove(uid, id); }
}
