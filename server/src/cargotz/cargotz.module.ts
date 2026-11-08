import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CtzParcel, CtzWarehouse, CtzStatusEvent, CtzStaff, CtzCollectorAccess } from './cargotz.entity';
import { CargoTzService } from './cargotz.service';
import { CargoTzController, CargoTzTrackController } from './cargotz.controller';

import { BeemModule } from '../notifications/beem.module';
import { User } from '../users/user.entity';
import { CargoTzTripController } from './cargotz-trip.controller';
import { CargoTzTripService } from './cargotz-trip.service';
import { CtzOperator, CtzPickup, CtzSmsOutbox, CtzTrackingChallenge, CtzTrip } from './cargotz-trip.entity';
import { CargoTzSmsService } from './cargotz-sms.service';
import { CargoTzTrackingAccessService } from './cargotz-tracking-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([CtzParcel, CtzWarehouse, CtzStatusEvent, CtzStaff, CtzCollectorAccess, CtzOperator, CtzPickup, CtzSmsOutbox, CtzTrackingChallenge, CtzTrip, User]), BeemModule],
  providers: [CargoTzService, CargoTzTripService, CargoTzSmsService, CargoTzTrackingAccessService],
  controllers: [CargoTzController, CargoTzTrackController, CargoTzTripController],
  exports: [CargoTzService],
})
export class CargoTzModule {}
