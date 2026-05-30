import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseItem, WarehouseMovement, WarehousePickTicket } from './warehouse.entity';
import { MovementsService, WarehouseItemsService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WarehouseItem, WarehouseMovement, WarehousePickTicket])],
  providers: [WarehouseItemsService, MovementsService],
  controllers: [WarehouseController],
  exports: [TypeOrmModule],
})
export class WarehouseModule {}
