import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
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
