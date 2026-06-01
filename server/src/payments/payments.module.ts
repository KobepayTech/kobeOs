import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditLoan, PaymentTransaction, Wallet } from './payments.entity';
import {
  PaymentAllocation,
  PaymentCustomer,
  PaymentDeposit,
  PaymentPayout,
  PaymentSupplier,
} from './kobepay.entity';
import { LoansService, TransactionsService, WalletsService } from './payments.service';
import {
  KobePayAllocationsService,
  KobePayCustomersService,
  KobePayDepositsService,
  KobePayPayoutsService,
  KobePaySuppliersService,
} from './kobepay.service';
import { KobePayOwnerService } from './kobepay-owner.service';
import { PaymentsController } from './payments.controller';
import { KobePayController } from './kobepay.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet, PaymentTransaction, CreditLoan,
      PaymentCustomer, PaymentSupplier, PaymentDeposit, PaymentPayout, PaymentAllocation,
    ]),
  ],
  providers: [
    WalletsService, TransactionsService, LoansService,
    KobePayCustomersService, KobePaySuppliersService,
    KobePayDepositsService, KobePayPayoutsService, KobePayAllocationsService,
    KobePayOwnerService,
  ],
  controllers: [PaymentsController, KobePayController],
})
export class PaymentsModule {}
