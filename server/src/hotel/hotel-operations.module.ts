import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelBooking, HotelFinancialRecord, HotelOrder, HotelRoom } from './hotel.entity';
import { HotelInventoryItem } from './hotel-extras.entity';
import { HotelAsset, HotelLedgerEntry, HotelPayrollRecord, HotelPettyCashEntry, HotelProcurementRequest } from './hotel-operations.entity';
import { HotelOperationsController } from './hotel-operations.controller';
import { HotelOperationsService } from './hotel-operations.service';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [TypeOrmModule.forFeature([HotelBooking, HotelOrder, HotelRoom, HotelFinancialRecord, HotelInventoryItem, HotelAsset, HotelLedgerEntry, HotelPayrollRecord, HotelPettyCashEntry, HotelProcurementRequest]), PlatformModule],
  controllers: [HotelOperationsController],
  providers: [HotelOperationsService],
})
export class HotelOperationsModule {}
