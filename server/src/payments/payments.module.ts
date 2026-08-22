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
import { KobePayAuditEvent, KobePayUser } from './kobepay-rbac.entity';
import { PayoutReceipt } from './payout-receipt.entity';
import { KobePayRate } from './kobepay-rate.entity';
import { KobepayDispatchAttempt } from './kobepay-dispatch.entity';
import { KobepayDispatcherService } from './kobepay-dispatcher.service';
import { KobepayRetryQueueService } from './kobepay-retry.service';
import { LoansService, TransactionsService, WalletsService } from './payments.service';
import {
  KobePayAllocationsService,
  KobePayCustomersService,
  KobePayDepositsService,
  KobePayPayoutsService,
  KobePaySuppliersService,
} from './kobepay.service';
import { KobePayCashierPerfService, KobePayOwnerService, KobePayRiskService } from './kobepay-owner.service';
import { KobePayRbacService } from './kobepay-rbac.service';
import { KobePayRatesService } from './kobepay-rate.service';
import { KobePayReceiptsService } from './kobepay-receipts.service';
import { PaymentsController } from './payments.controller';
import { KobePayController } from './kobepay.controller';
import { KobePayReceiptsController, PublicReceiptController } from './kobepay-receipts.controller';
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Wallet, PaymentTransaction, CreditLoan,
      PaymentCustomer, PaymentSupplier, PaymentDeposit, PaymentPayout, PaymentAllocation,
      KobePayUser, KobePayAuditEvent, KobePayRate, KobepayDispatchAttempt,
      PayoutReceipt,
    ]),
    ErpModule,
  ],
  providers: [
    WalletsService, TransactionsService, LoansService,
    KobePayCustomersService, KobePaySuppliersService,
    KobePayDepositsService, KobePayPayoutsService, KobePayAllocationsService,
    KobePayOwnerService, KobePayCashierPerfService, KobePayRiskService,
    KobePayRbacService, KobePayRatesService,
    KobepayDispatcherService, KobepayRetryQueueService,
    KobePayReceiptsService,
  ],
  controllers: [PaymentsController, KobePayController, KobePayReceiptsController, PublicReceiptController],
})
export class PaymentsModule {}
