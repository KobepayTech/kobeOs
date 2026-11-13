import { Body, Controller, Delete, Get, Header, Headers, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CargoTzTrackingAccessService } from './cargotz-tracking-access.service';
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

class CollectorInviteDto {
  @IsString() @Matches(/\S/) @MaxLength(120) companyName!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) agentName!: string;
  @Matches(/^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ()-]{7,25}$/) agentPhone!: string;
}

class AcceptCollectorInviteDto {
  @Matches(/^[a-f0-9]{64}$/) token!: string;
}

class SubmitCollectionDto {
  @IsUUID() accessId!: string;
  @IsUUID() requestId!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) ownerName!: string;
  @Matches(/^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ()-]{7,25}$/) ownerPhone!: string;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(120) receiverName?: string;
  @IsOptional() @Matches(/^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ()-]{7,25}$/) receiverPhone?: string;
  @IsString() @Matches(/\S/) @MaxLength(80) origin!: string;
  @IsString() @Matches(/\S/) @MaxLength(80) destination!: string;
  @IsString() @Matches(/\S/) @MaxLength(500) description!: string;
  @IsInt() @Min(1) @Max(100) cartonCount!: number;
  @IsIn(['PICKUP', 'DROPOFF']) handoff!: 'PICKUP' | 'DROPOFF';
  @IsString() @Matches(/\S/) @MaxLength(500) handoffLocation!: string;
}

export class ConfirmHandoffDto {
  @IsOptional() @IsNumber() @Min(0.01) @Max(100000) weight?: number;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100000) lengthCm?: number;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100000) widthCm?: number;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100000) heightCm?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
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

class FreightPaymentDto {
  @IsBoolean() paid!: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999.99) transportFee?: number;
}

class StaffDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(['Owner', 'Agent', 'Warehouse']) role!: CtzRole;
  @Matches(/^\d{4}$/) pin!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() warehouse?: string;
}

class UpdateStaffDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsIn(['Owner', 'Agent', 'Warehouse']) role?: CtzRole;
  @IsOptional() @Matches(/^\d{4}$/) pin?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() warehouse?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('cargotz')
export class CargoTzController {
  constructor(private readonly svc: CargoTzService) {}

  private ctx(uid: string, pin?: string) { return this.svc.actor(uid, pin); }

  @Get('freight-volume')
  freightVolume(@CurrentUser('id') uid: string) { return this.svc.freightVolume(uid); }

  /* Owner dashboard */
  @Get('dashboard') dashboard(@CurrentUser('id') uid: string) { return this.svc.dashboard(uid); }

  /* Staff / roles */
  @Get('staff') listStaff(@CurrentUser('id') uid: string) { return this.svc.listStaff(uid); }
  @Post('staff') createStaff(@CurrentUser('id') uid: string, @Body() dto: StaffDto) { return this.svc.createStaff(uid, dto); }
  @Patch('staff/:id') updateStaff(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) { return this.svc.updateStaff(uid, id, dto); }
  @Delete('staff/:id') removeStaff(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.removeStaff(uid, id); }

  @Get('collector-invites')
  listInvites(@CurrentUser('id') uid: string) { return this.svc.listCollectorInvites(uid); }

  @Post('collector-invites')
  invite(@CurrentUser('id') uid: string, @Body() dto: CollectorInviteDto) {
    return this.svc.inviteCollector(uid, dto);
  }

  @Post('collector-invites/:id/approve')
  approve(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.approveCollector(uid, id);
  }

  @Delete('collector-invites/:id')
  revoke(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.revokeCollector(uid, id);
  }

  @Post('collector/accept')
  accept(@CurrentUser('id') uid: string, @Body() dto: AcceptCollectorInviteDto) {
    return this.svc.acceptCollectorInvite(uid, dto.token);
  }

  @Get('collector/companies')
  companies(@CurrentUser('id') uid: string) { return this.svc.collectorCompanies(uid); }

  @Post('collector/collections')
  submitCollection(@CurrentUser('id') uid: string, @Body() dto: SubmitCollectionDto) {
    return this.svc.submitCollection(uid, dto);
  }

  @Get('handoffs')
  handoffs(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin?: string) {
    return this.svc.pendingHandoffs(uid, pin);
  }

  @Get('handoffs/:tracking')
  handoff(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Param('tracking') tracking: string) {
    return this.svc.handoff(uid, pin, tracking);
  }

  @Post('handoffs/:tracking/confirm')
  confirm(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Param('tracking') tracking: string, @Body() dto: ConfirmHandoffDto) {
    return this.svc.confirmHandoff(uid, pin, tracking, dto);
  }

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
  async pay(@CurrentUser('id') uid: string, @Headers('x-ctz-pin') pin: string, @Param('idOrTracking') k: string, @Body() dto: FreightPaymentDto) {
    return this.svc.setPayment(uid, await this.ctx(uid, pin), k, dto);
  }
}

class TrackingPhoneDto {
  @Matches(/^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ()-]{7,25}$/) phone!: string;
}
class TrackingCodeDto extends TrackingPhoneDto {
  @Matches(/^\d{6}$/) code!: string;
}

/** Public tracking keeps customer details behind phone verification. */
@Public()
@Controller('cargotz-track')
export class CargoTzTrackController {
  constructor(private readonly svc: CargoTzService, private readonly access: CargoTzTrackingAccessService) {}

  @Get(':tracking') track(@Param('tracking') tracking: string) { return this.svc.track(tracking); }

  @Post(':tracking/owner-code')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  requestCode(@Param('tracking') tracking: string, @Body() dto: TrackingPhoneDto) {
    return this.access.request(tracking, dto.phone);
  }

  @Post(':tracking/owner-details')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  ownerDetails(@Param('tracking') tracking: string, @Body() dto: TrackingCodeDto) {
    return this.access.verify(tracking, dto.phone, dto.code);
  }
}
