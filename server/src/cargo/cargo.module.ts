import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CargoDriver, CargoFlight, CargoPayment, Parcel, Shipment } from './cargo.entity';
import {
  CargoPaymentsService, DriversService, FlightsService, ParcelsService, ShipmentsService,
} from './cargo.service';
import { CargoController } from './cargo.controller';
import { CargoGateway } from './cargo.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, Shipment, CargoDriver, CargoFlight, CargoPayment]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    NotificationsModule,
  ],
  // ShipmentsService needs CargoDriver + CargoFlight repos for assignment validation.
  providers: [
    ParcelsService, ShipmentsService, DriversService, FlightsService,
    CargoPaymentsService, CargoGateway,
  ],
  controllers: [CargoController],
  exports: [
    ParcelsService, ShipmentsService, DriversService, FlightsService, CargoPaymentsService,
  ],
})
export class CargoModule {}
