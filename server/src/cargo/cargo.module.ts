import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CargoDriver, CargoFlight, Parcel, Shipment } from './cargo.entity';
import { DriversService, FlightsService, ParcelsService, ShipmentsService } from './cargo.service';
import { CargoController } from './cargo.controller';
import { CargoGateway } from './cargo.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, Shipment, CargoDriver, CargoFlight]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  // ShipmentsService needs CargoDriver + CargoFlight repos for assignment validation.
  providers: [ParcelsService, ShipmentsService, DriversService, FlightsService, CargoGateway],
  controllers: [CargoController],
  exports: [ParcelsService, ShipmentsService, DriversService, FlightsService],
})
export class CargoModule {}
