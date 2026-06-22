import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CargoCustomer, CargoDriver, CargoFlight, CargoLane, CargoPayment,
  ConsolidationBox, Parcel, Shipment,
} from './cargo.entity';
import {
  CargoPaymentsService, DriversService, FlightsService, ParcelsService, ShipmentsService,
} from './cargo.service';
import { CargoConsolidationService } from './cargo-consolidation.service';
import { CargoController } from './cargo.controller';
import { CargoConsolidationController } from './cargo-consolidation.controller';
import { CargoGateway } from './cargo.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Parcel, Shipment, CargoDriver, CargoFlight, CargoPayment,
      CargoCustomer, CargoLane, ConsolidationBox,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    NotificationsModule,
  ],
  providers: [
    ParcelsService, ShipmentsService, DriversService, FlightsService,
    CargoPaymentsService, CargoGateway, CargoConsolidationService,
  ],
  controllers: [CargoController, CargoConsolidationController],
  exports: [
    ParcelsService, ShipmentsService, DriversService, FlightsService, CargoPaymentsService,
    CargoConsolidationService,
  ],
})
export class CargoModule {}
