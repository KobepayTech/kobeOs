import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CargoDriver, CargoFlight, Parcel, Shipment } from './cargo.entity';
import { DriversService, FlightsService, ParcelsService, ShipmentsService } from './cargo.service';
import { CargoController } from './cargo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Parcel, Shipment, CargoDriver, CargoFlight])],
  // ShipmentsService needs CargoDriver + CargoFlight repos for assignment validation.
  providers: [ParcelsService, ShipmentsService, DriversService, FlightsService],
  controllers: [CargoController],
  exports: [ParcelsService, ShipmentsService, DriversService, FlightsService],
})
export class CargoModule {}
