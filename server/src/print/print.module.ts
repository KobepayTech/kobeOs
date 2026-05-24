import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrintCustomer, PrintJob, PrintMaterial, PrintProduct } from './print.entity';
import {
  PrintCustomersService, PrintJobsService, PrintMaterialsService, PrintProductsService,
} from './print.service';
import { PrintController } from './print.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrintProduct, PrintJob, PrintMaterial, PrintCustomer])],
  providers: [PrintProductsService, PrintJobsService, PrintMaterialsService, PrintCustomersService],
  controllers: [PrintController],
})
export class PrintModule {}
