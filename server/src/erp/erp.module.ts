import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from '../payments/payments.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { Contact } from '../contacts/contact.entity';
import { PrintJob } from '../print/print.entity';
import { ErpAccount, ErpTransaction, LoyaltyCustomer, PurchaseOrder, Supplier } from './erp.entity';
import { ErpKobepayInbox, ErpKobepayProvider } from './erp-kobepay-inbox.entity';
import {
  ErpKobePayLink,
  ErpKobePaySupplierReceipt,
  ErpPurchaseOrder,
  ErpSupplier,
  ErpSupplierCapitalLedger,
} from './supplier-capital.entity';
import { ErpService } from './erp.service';
import { JournalService } from './journal.service';
import { ErpKobepayInboxService } from './erp-kobepay-inbox.service';
import { SupplierCapitalService } from './supplier-capital.service';
import { ErpController } from './erp.controller';
import { ErpKobepayInboxController } from './erp-kobepay-inbox.controller';
import { SupplierCapitalController } from './supplier-capital.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction, PosOrder, PosProduct, WarehouseItem, Contact, PrintJob,
      ErpAccount, ErpTransaction,
      PurchaseOrder, Supplier, LoyaltyCustomer,
      ErpKobepayProvider, ErpKobepayInbox,
      ErpKobePayLink, ErpKobePaySupplierReceipt, ErpPurchaseOrder, ErpSupplier, ErpSupplierCapitalLedger,
    ]),
  ],
  providers: [ErpService, JournalService, ErpKobepayInboxService, SupplierCapitalService],
  controllers: [ErpController, ErpKobepayInboxController, SupplierCapitalController],
  exports: [JournalService, SupplierCapitalService],
})
export class ErpModule {}
