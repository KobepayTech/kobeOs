import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from '../payments/payments.entity';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { Contact } from '../contacts/contact.entity';
import { PrintJob } from '../print/print.entity';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction, PosOrder, PosProduct, WarehouseItem, Contact, PrintJob])],
  providers: [ErpService],
  controllers: [ErpController],
})
export class ErpModule {}
