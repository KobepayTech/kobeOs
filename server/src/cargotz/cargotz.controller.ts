import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CargoTzService } from './cargotz.service';
import { CTZ_STATUSES, CtzRole, CtzStatus } from './cargotz.entity';

class CreateParcelDto {
  @IsString() @MaxLength(120) senderName!: string;
  @IsString() @MaxLength(40) senderPhone!: string;
  @IsOptional() @IsString() senderId?: string;
  @IsString() @MaxLength(120) receiverName!: string;
  @IsString() @MaxLength(40) receiverPhone!: string;
  @IsOptional() @IsString() parcelType?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsNumber() @Min(1) quantity?: number;
  @IsOptional() @IsNumber() @Min(0) weight?: number;
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsString() @MaxLength(80) origin!: string;
  @IsString() @MaxLength(80) destination!: string;
  @IsOptional() @IsNumber() @Min(0) transportFee?: number;
  @IsOptional() @IsIn(['PAID', 'UNPAID']) paymentStatus?: 'PAID' | 'UNPAID';
  @IsOptional() @IsBoolean() fragile?: boolean;
  @IsOptional() @IsBoolean() cashOnDelivery?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() photoUrl?: string;
}

class PackDto {
  @IsOptional() @IsString() warehouseLocation?: string;
  @IsOptional() @IsString() shelfNumber?: string;
  @IsOptional() @IsString() bagNumber?: string;
  @IsOptional() @IsString() busNumber?: string;
  @IsOptional() @IsString() driverName?: string;
  @IsOptional() @IsString() driverPhone?: string;
  @IsOptional() @IsString() departureTime?: string;
  @IsOptional() @IsString() expectedArrival?: string;
}

class AdvanceDto {
  @IsIn(CTZ_STATUSES as unknown as string[]) status!: CtzStatus;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() note?: string;
}

class StaffDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['Owner', 'Agent', 'Warehouse']) role!: CtzRole;
  @IsString() pin!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() warehouse?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('cargotz')
export class CargoTzController {
  constructor(private readonly svc: CargoTzService) {}

  private ctx(uid: string, pin?: string) { return this.svc.actor(uid, pin); }

  /* Owner dashboard */
  @Get('dashboard') dashboard(@CurrentUser('id') uid: string) { return this.svc.dashboard(uid); }

  /* Staff / roles */
  @Get('staff') listStaff(@CurrentUser('id') uid: string) { return this.svc.listStaff(uid); }
  @Post('staff') createStaff(@CurrentUser('id') uid: string, @Body() dto: StaffDto) { return this.svc.createStaff(uid, dto); }
  @Patch('staff/:id') updateStaff(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: Partial<StaffDto>) { return this.svc.updateStaff(uid, id, dto as never); }
  @Delete('staff/:id') removeStaff(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.removeStaff(uid, id); }

  /* Parcels */
  @Get('parcels') list(@CurrentUser('id') uid: string, @Query('status') status?: string, @Query('q') q?: string) { return this.svc.list(uid, { status, q }); }
  @Get('parcels/:idOrTracking') getOne(@CurrentUser('id') uid: string, @Param('idOrTracking') k: string) { return this.svc.getOne(uid, k); }

  @Post('parcels')
  async create(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Body() dto: CreateParcelDto) {
    return this.svc.createParcel(uid, await this.ctx(uid, pin), dto);
  }

  @Post('parcels/:idOrTracking/pack')
  async pack(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Param('idOrTracking') k: string, @Body() dto: PackDto) {
    return this.svc.pack(uid, await this.ctx(uid, pin), k, dto);
  }

  @Post('parcels/:idOrTracking/status')
  async advance(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Param('idOrTracking') k: string, @Body() dto: AdvanceDto) {
    return this.svc.advance(uid, await this.ctx(uid, pin), k, dto);
  }

  @Post('parcels/:idOrTracking/payment')
  async pay(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Param('idOrTracking') k: string, @Body() dto: { paid: boolean }) {
    return this.svc.setPayment(uid, await this.ctx(uid, pin), k, !!dto.paid);
  }
}

/** Public tracking — the QR / tracking-number lookup, no auth. */
@Public()
@Controller('cargotz-track')
export class CargoTzTrackController {
  constructor(private readonly svc: CargoTzService) {}

  @Get(':tracking') track(@Param('tracking') tracking: string) { return this.svc.track(tracking); }
}
