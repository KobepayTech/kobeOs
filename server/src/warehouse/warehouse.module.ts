import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseItem, WarehouseMovement } from './warehouse.entity';
import { MovementsService, WarehouseItemsService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WarehouseItem, WarehouseMovement])],
  providers: [WarehouseItemsService, MovementsService],
  controllers: [WarehouseController],
})
export class WarehouseModule {}
