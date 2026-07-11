import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CtzParcel, CtzWarehouse, CtzStatusEvent, CtzStaff } from './cargotz.entity';
import { CargoTzService } from './cargotz.service';
import { CargoTzController, CargoTzTrackController } from './cargotz.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CtzParcel, CtzWarehouse, CtzStatusEvent, CtzStaff])],
  providers: [CargoTzService],
  controllers: [CargoTzController, CargoTzTrackController],
  exports: [CargoTzService],
})
export class CargoTzModule {}
