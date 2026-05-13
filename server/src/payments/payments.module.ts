import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditLoan, PaymentTransaction, Wallet } from './payments.entity';
import { LoansService, TransactionsService, WalletsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, PaymentTransaction, CreditLoan])],
  providers: [WalletsService, TransactionsService, LoansService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
