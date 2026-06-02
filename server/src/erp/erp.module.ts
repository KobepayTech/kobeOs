import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from '../payments/payments.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { Contact } from '../contacts/contact.entity';
import { PrintJob } from '../print/print.entity';
import { ErpAccount, ErpTransaction, PurchaseOrder, Supplier } from './erp.entity';
import { ErpKobepayInbox, ErpKobepayProvider } from './erp-kobepay-inbox.entity';
import { ErpService } from './erp.service';
import { JournalService } from './journal.service';
import { ErpKobepayInboxService } from './erp-kobepay-inbox.service';
import { ErpController } from './erp.controller';
import { ErpKobepayInboxController } from './erp-kobepay-inbox.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction, PosOrder, PosProduct, WarehouseItem, Contact, PrintJob,
      ErpAccount, ErpTransaction,
      PurchaseOrder, Supplier,
      ErpKobepayProvider, ErpKobepayInbox,
    ]),
  ],
  providers: [ErpService, JournalService, ErpKobepayInboxService],
  controllers: [ErpController, ErpKobepayInboxController],
  exports: [JournalService],
})
export class ErpModule {}
