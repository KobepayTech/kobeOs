import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MzigoAgent, MzigoCompany, MzigoParcel, MzigoTruckManifest } from './mzigo.entity';
import { MzigoService } from './mzigo.service';
import { MzigoController, MzigoTrackingController, MzigoTrucksController } from './mzigo.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { BeemService } from '../notifications/beem.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MzigoCompany, MzigoAgent, MzigoParcel, MzigoTruckManifest]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.getOrThrow<string>('JWT_SECRET') }),
    }),
    NotificationsModule,
  ],
  providers: [MzigoService, BeemService],
  controllers: [MzigoController, MzigoTrucksController, MzigoTrackingController],
  exports: [MzigoService],
})
export class MzigoModule {}
