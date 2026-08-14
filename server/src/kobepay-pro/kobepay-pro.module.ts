import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  KpAccount, KpBankDeposit, KpBucket, KpGroupOrder, KpLedgerLine, KpMerchant, KpMerchantApproval,
  KpPurchaseGroup, KpReservedHold, KpSchool, KpStarterPack, KpStudent, KpSupplier, KpTransaction, KpWallet,
} from './kobepay-pro.entity';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';
import { DepositEngineService } from './deposit-engine.service';
import { RuleEngineService } from './rule-engine.service';
import { PaymentService } from './payment.service';
import { SchoolService } from './school.service';
import { GroupsService } from './groups.service';
import { StarterPackService } from './starter-pack.service';
import { PortalService } from './portal.service';
import { ConnectService } from './connect.service';
import {
  KobepayProController, SupplierPortalController, StudentPortalController, ConnectController,
} from './kobepay-pro.controller';
import { MobileMoneyModule } from '../mobile-money/mobile-money.module';

/**
 * Kobepay Pro — programmable school financial OS.
 * Phase 1: double-entry ledger, student wallets (Available/Restricted/Reserved/
 * Savings), M-Pesa SMS deposit engine, rule engine and approved-merchant pay.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      KpSchool, KpStudent, KpMerchant, KpMerchantApproval,
      KpAccount, KpTransaction, KpLedgerLine,
      KpWallet, KpBucket, KpReservedHold, KpBankDeposit,
      KpSupplier, KpPurchaseGroup, KpGroupOrder, KpStarterPack,
    ]),
    MobileMoneyModule,
  ],
  providers: [
    LedgerService, WalletService, DepositEngineService,
    RuleEngineService, PaymentService, SchoolService, GroupsService,
    StarterPackService, PortalService, ConnectService,
  ],
  controllers: [KobepayProController, SupplierPortalController, StudentPortalController, ConnectController],
  exports: [LedgerService, WalletService, DepositEngineService, PaymentService, SchoolService, GroupsService],
})
export class KobepayProModule {}
