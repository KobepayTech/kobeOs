import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Warehouse, WarehouseItem, WarehouseMovement } from './warehouse.entity';
import { WarehousePickTicket, WarehousePickTicketItem } from './pick-ticket.entity';
import { MovementsService, WarehouseItemsService } from './warehouse.service';
import { WarehousesService } from './warehouses.service';
import { PickTicketService } from './pick-ticket.service';
import { WarehouseController } from './warehouse.controller';
import { PickTicketController } from './pick-ticket.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Warehouse,
      WarehouseItem,
      WarehouseMovement,
      WarehousePickTicket,
      WarehousePickTicketItem,
    ]),
  ],
  providers: [WarehousesService, WarehouseItemsService, MovementsService, PickTicketService],
  controllers: [WarehouseController, PickTicketController],
  exports: [PickTicketService, WarehousesService],
})
export class WarehouseModule {}
