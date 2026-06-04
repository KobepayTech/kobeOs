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
import { AirCargoService } from './air-cargo.service';
import { AirCargoController } from './air-cargo.controller';

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
    ]),
  ],
  providers: [AirCargoService],
  controllers: [AirCargoController],
  exports: [AirCargoService],
})
export class AirCargoModule {}
