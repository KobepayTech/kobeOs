import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CargoDriver, CargoFlight, Parcel, Shipment } from './cargo.entity';
import { DriversService, FlightsService, ParcelsService, ShipmentsService } from './cargo.service';
import { CargoController } from './cargo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Parcel, Shipment, CargoDriver, CargoFlight])],
  providers: [ParcelsService, ShipmentsService, DriversService, FlightsService],
  controllers: [CargoController],
})
export class CargoModule {}
