import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MovementsService, WarehouseItemsService } from './warehouse.service';
import { WarehousesService } from './warehouses.service';
import { CreateItemDto, CreateWarehouseDto, MovementDto, UpdateItemDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@UseGuards(JwtAuthGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(
    private readonly items: WarehouseItemsService,
    private readonly movements: MovementsService,
    private readonly warehouses: WarehousesService,
  ) {}

  @Get('warehouses') listWarehouses(@CurrentUser('id') uid: string) { return this.warehouses.list(uid); }
  @Post('warehouses') createWarehouse(@CurrentUser('id') uid: string, @Body() dto: CreateWarehouseDto) { return this.warehouses.create(uid, dto); }
  @Patch('warehouses/:id') updateWarehouse(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateWarehouseDto) { return this.warehouses.update(uid, id, dto); }
  @Delete('warehouses/:id') removeWarehouse(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.warehouses.remove(uid, id); }

  @Get('items') listItems(@CurrentUser('id') uid: string, @Query('warehouseId') warehouseId?: string) { return this.items.listByWarehouse(uid, warehouseId); }
  @Post('items') createItem(@CurrentUser('id') uid: string, @Body() dto: CreateItemDto) { return this.items.create(uid, dto); }
  @Patch('items/:id') updateItem(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateItemDto) { return this.items.update(uid, id, dto); }
  @Delete('items/:id') removeItem(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.items.remove(uid, id); }

  @Get('movements') listMovements(@CurrentUser('id') uid: string) { return this.movements.list(uid); }
  @Post('movements') recordMovement(@CurrentUser('id') uid: string, @Body() dto: MovementDto) { return this.movements.record(uid, dto); }
}
