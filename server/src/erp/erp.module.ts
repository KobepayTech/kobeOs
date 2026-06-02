import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from '../payments/payments.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { Contact } from '../contacts/contact.entity';
import { PrintJob } from '../print/print.entity';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import {
  ErpKobePayLink,
  ErpKobePaySupplierReceipt,
  ErpPurchaseOrder,
  ErpSupplier,
  ErpSupplierCapitalLedger,
} from './supplier-capital.entity';
import { SupplierCapitalService } from './supplier-capital.service';
import { SupplierCapitalController } from './supplier-capital.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      PosOrder,
      PosProduct,
      WarehouseItem,
      Contact,
      PrintJob,
      ErpKobePayLink,
      ErpSupplier,
      ErpPurchaseOrder,
      ErpKobePaySupplierReceipt,
      ErpSupplierCapitalLedger,
    ]),
  ],
  providers: [ErpService, SupplierCapitalService],
  controllers: [ErpController, SupplierCapitalController],
})
export class ErpModule {}
