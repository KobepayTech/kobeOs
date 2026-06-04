import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CargoAirHub, CargoAirline, CargoAirRoutePlan } from './air-cargo.entity';
import {
  CargoAnalyticsSnapshot,
  CargoCustomsFlow,
  CargoLastMileDelivery,
  CargoOperationalAssessment,
  CargoTrackingEvent,
} from './air-cargo-ops.entity';
import { Shipment } from './cargo.entity';
import { AirCargoService } from './air-cargo.service';
import { AirCargoController } from './air-cargo.controller';
import { Fr24Service } from './fr24.service';
import { Fr24Controller, Fr24ShipmentController } from './fr24.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CargoAirHub,
      CargoAirline,
      CargoAirRoutePlan,
      CargoCustomsFlow,
      CargoTrackingEvent,
      CargoOperationalAssessment,
      CargoLastMileDelivery,
      CargoAnalyticsSnapshot,
      Shipment,
    ]),
  ],
  providers: [AirCargoService, Fr24Service],
  controllers: [AirCargoController, Fr24Controller, Fr24ShipmentController],
  exports: [AirCargoService, Fr24Service],
})
export class AirCargoModule {}
