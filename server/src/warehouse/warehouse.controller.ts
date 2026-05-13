import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MovementsService, WarehouseItemsService } from './warehouse.service';
import { CreateItemDto, MovementDto, UpdateItemDto } from './dto/warehouse.dto';

@UseGuards(JwtAuthGuard)
@Controller('warehouse')
export class WarehouseController {
  constructor(
    private readonly items: WarehouseItemsService,
    private readonly movements: MovementsService,
  ) {}

  @Get('items') listItems(@CurrentUser('id') uid: string) { return this.items.list(uid); }
  @Post('items') createItem(@CurrentUser('id') uid: string, @Body() dto: CreateItemDto) { return this.items.create(uid, dto); }
  @Patch('items/:id') updateItem(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateItemDto) { return this.items.update(uid, id, dto); }
  @Delete('items/:id') removeItem(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.items.remove(uid, id); }

  @Get('movements') listMovements(@CurrentUser('id') uid: string) { return this.movements.list(uid); }
  @Post('movements') recordMovement(@CurrentUser('id') uid: string, @Body() dto: MovementDto) { return this.movements.record(uid, dto); }
}
