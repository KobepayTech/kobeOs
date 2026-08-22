import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HotelInventoryService, HotelStaffService, HotelChannelsService } from './hotel-extras.service';

// Decorated so the global whitelist ValidationPipe keeps the fields.
class InventoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) reorderLevel?: number;
  @IsOptional() @IsNumber() @Min(0) costPerUnit?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() hotelId?: string;
}
class StaffDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() status?: 'active' | 'off' | 'suspended';
  @IsOptional() @IsString() hotelId?: string;
}
class ChannelDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsBoolean() connected?: boolean;
  @IsOptional() @IsNumber() @Min(0) commissionPct?: number;
  @IsOptional() @IsString() hotelId?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('hotel')
export class HotelExtrasController {
  constructor(
    private readonly inventory: HotelInventoryService,
    private readonly staff: HotelStaffService,
    private readonly channels: HotelChannelsService,
  ) {}

  // ── Inventory ──
  @Get('inventory') listInventory(@CurrentUser('id') uid: string) { return this.inventory.list(uid); }
  @Post('inventory') createInventory(@CurrentUser('id') uid: string, @Body() dto: InventoryDto) { return this.inventory.create(uid, dto as any); }
  @Patch('inventory/:id') updateInventory(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: InventoryDto) { return this.inventory.update(uid, id, dto as any); }
  @Delete('inventory/:id') removeInventory(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.inventory.remove(uid, id); }

  // ── Staff ──
  @Get('staff') listStaff(@CurrentUser('id') uid: string) { return this.staff.list(uid); }
  @Post('staff') createStaff(@CurrentUser('id') uid: string, @Body() dto: StaffDto) { return this.staff.create(uid, dto as any); }
  @Patch('staff/:id') updateStaff(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: StaffDto) { return this.staff.update(uid, id, dto as any); }
  @Delete('staff/:id') removeStaff(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.staff.remove(uid, id); }

  // ── Channels ──
  @Get('channels') listChannels(@CurrentUser('id') uid: string) { return this.channels.list(uid); }
  @Post('channels') createChannel(@CurrentUser('id') uid: string, @Body() dto: ChannelDto) { return this.channels.create(uid, dto as any); }
  @Patch('channels/:id') updateChannel(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ChannelDto) { return this.channels.update(uid, id, dto as any); }
  @Delete('channels/:id') removeChannel(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.channels.remove(uid, id); }
}
