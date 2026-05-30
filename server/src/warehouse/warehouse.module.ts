import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarehouseItem, WarehouseMovement } from './warehouse.entity';
import { WarehousePickTicket, WarehousePickTicketItem } from './pick-ticket.entity';
import { MovementsService, WarehouseItemsService } from './warehouse.service';
import { PickTicketService } from './pick-ticket.service';
import { WarehouseController } from './warehouse.controller';
import { PickTicketController } from './pick-ticket.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseItem,
      WarehouseMovement,
      WarehousePickTicket,
      WarehousePickTicketItem,
    ]),
  ],
  providers: [WarehouseItemsService, MovementsService, PickTicketService],
  controllers: [WarehouseController, PickTicketController],
  exports: [PickTicketService],
})
export class WarehouseModule {}
