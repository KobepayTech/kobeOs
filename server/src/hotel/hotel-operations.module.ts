import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelBooking, HotelOrder } from './hotel.entity';
import { HotelInventoryItem } from './hotel-extras.entity';
import { HotelAsset, HotelLedgerEntry, HotelPayrollRecord, HotelPettyCashEntry, HotelProcurementRequest } from './hotel-operations.entity';
import { HotelOperationsController } from './hotel-operations.controller';
import { HotelOperationsService } from './hotel-operations.service';

@Module({
  imports: [TypeOrmModule.forFeature([HotelBooking, HotelOrder, HotelInventoryItem, HotelAsset, HotelLedgerEntry, HotelPayrollRecord, HotelPettyCashEntry, HotelProcurementRequest])],
  controllers: [HotelOperationsController],
  providers: [HotelOperationsService],
})
export class HotelOperationsModule {}
