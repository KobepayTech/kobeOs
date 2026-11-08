import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsUUID, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConfirmHandoffDto } from './cargotz.controller';
import { CargoTzService } from './cargotz.service';
import { CTZ_OPERATION_ROLES, CtzOperationRole } from './cargotz-trip.entity';
import { CargoTzTripService } from './cargotz-trip.service';

const TRACKING = /^CTZ-\d{8}-(?:[A-F0-9]{20}|\d{6,12})$/i;
const TRIP_ROLES = { Dispatch: 'Dispatch', Loading: 'Loading', Destination: 'Destination' } as const;
type TripRole = keyof typeof TRIP_ROLES;

class AssignStaffDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(CTZ_OPERATION_ROLES) role!: CtzOperationRole;
  @Matches(/\S/) @MaxLength(80) branch!: string;
}
class TripDto {
  @IsUUID('4') id!: string;
  @Matches(/\S/) @MaxLength(80) origin!: string;
  @Matches(/^[A-Z0-9 -]{4,20}$/i) plate!: string;
  @Matches(/\S/) @MaxLength(40) vehicleType!: string;
  @Matches(/\S/) @MaxLength(120) operator!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(300) @Matches(TRACKING, { each: true }) trackingNumbers!: string[];
}
class ScanDto {
  @Matches(TRACKING) tracking!: string;
  @IsBoolean() @IsOptional() loaded?: boolean;
}
class BranchDto {
  @Matches(/\S/) @MaxLength(80) branch!: string;
}
class ArrivalDto extends BranchDto {
  @Matches(/^[A-Z0-9 -]{4,20}$/i) plate!: string;
}
class ReleaseDto extends BranchDto {
  @Matches(TRACKING) tracking!: string;
}
class UnloadDto extends ReleaseDto {
  @IsIn(['RECEIVED', 'MISSING', 'DAMAGED', 'EXTRA']) result!: 'RECEIVED' | 'MISSING' | 'DAMAGED' | 'EXTRA';
}
class CollectDto extends ReleaseDto {
  @Matches(/^\d{6}$/) code!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('cargotz/operations')
export class CargoTzTripController {
  constructor(private readonly trips: CargoTzTripService, private readonly cargo: CargoTzService) {}

  @Get('workspaces')
  workspaces(@CurrentUser('id') uid: string) { return this.trips.workspaces(uid); }

  @Get('staff')
  staff(@CurrentUser('id') uid: string) { return this.trips.staff(uid); }

  @Post('staff')
  async assign(@CurrentUser('id') uid: string, @Body() dto: AssignStaffDto) {
    await this.trips.assign(uid, dto);
    return { ok: true };
  }

  @Delete('staff/:id')
  async revoke(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.trips.revoke(uid, id);
    return { ok: true };
  }

  @Get(':workspace/intake')
  async intake(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Query('branch') branch?: string) {
    const scope = await this.trips.scope(uid, workspace, 'Intake', branch);
    return this.cargo.pendingHandoffs(scope.ownerId, undefined, scope);
  }

  @Get(':workspace/intake/:tracking')
  async handoff(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('tracking') tracking: string, @Query('branch') branch?: string) {
    const scope = await this.trips.scope(uid, workspace, 'Intake', branch);
    return this.cargo.handoff(scope.ownerId, undefined, tracking, scope);
  }

  @Post(':workspace/intake/:tracking/confirm')
  async confirm(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('tracking') tracking: string, @Body() dto: ConfirmHandoffDto, @Query('branch') branch?: string) {
    const scope = await this.trips.scope(uid, workspace, 'Intake', branch);
    return this.cargo.confirmHandoff(scope.ownerId, undefined, tracking, dto, scope);
  }

  @Get(':workspace/ready')
  async ready(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Query('branch') branch?: string) {
    return this.trips.ready(await this.trips.scope(uid, workspace, 'Dispatch', branch));
  }

  @Post(':workspace/trips')
  async create(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Body() dto: TripDto) {
    return this.trips.create(await this.trips.scope(uid, workspace, 'Dispatch', dto.origin), dto);
  }

  @Get(':workspace/trips')
  async list(
    @CurrentUser('id') uid: string, @Param('workspace') workspace: string,
    @Query('role', new ParseEnumPipe(TRIP_ROLES)) role: TripRole, @Query('branch') branch?: string, @Query('plate') plate?: string,
  ) {
    return this.trips.list(await this.trips.scope(uid, workspace, role, branch), role, plate);
  }

  @Get(':workspace/trips/:id')
  async view(
    @CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string,
    @Query('role', new ParseEnumPipe(TRIP_ROLES)) role: TripRole, @Query('branch') branch?: string,
  ) {
    return this.trips.view(await this.trips.scope(uid, workspace, role, branch), role, id);
  }

  @Post(':workspace/trips/:id/scan')
  async scan(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScanDto, @Query('branch') branch?: string) {
    return this.trips.loadingScan(await this.trips.scope(uid, workspace, 'Loading', branch), id, dto.tracking, dto.loaded ?? true);
  }

  @Post(':workspace/trips/:id/seal')
  async seal(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Query('branch') branch?: string) {
    return this.trips.seal(await this.trips.scope(uid, workspace, 'Loading', branch), id);
  }

  @Post(':workspace/trips/:id/depart')
  async depart(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Query('branch') branch?: string) {
    return this.trips.depart(await this.trips.scope(uid, workspace, 'Dispatch', branch), id);
  }

  @Post(':workspace/trips/:id/cancel')
  async cancel(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Query('branch') branch?: string) {
    return this.trips.cancel(await this.trips.scope(uid, workspace, 'Dispatch', branch), id);
  }

  @Post(':workspace/trips/:id/arrive')
  async arrive(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArrivalDto) {
    return this.trips.arrive(await this.trips.scope(uid, workspace, 'Destination', dto.branch), id, dto.branch, dto.plate);
  }

  @Post(':workspace/trips/:id/unload')
  async unload(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UnloadDto) {
    return this.trips.unload(await this.trips.scope(uid, workspace, 'Destination', dto.branch), id, dto.branch, dto.tracking, dto.result);
  }

  @Post(':workspace/trips/:id/release')
  async release(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseDto) {
    return this.trips.release(await this.trips.scope(uid, workspace, 'Destination', dto.branch), id, dto.branch, dto.tracking);
  }

  @Post(':workspace/trips/:id/collect')
  async collect(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CollectDto) {
    return this.trips.collect(await this.trips.scope(uid, workspace, 'Destination', dto.branch), id, dto.branch, dto.tracking, dto.code);
  }

  @Post(':workspace/trips/:id/retry-messages')
  async retry(@CurrentUser('id') uid: string, @Param('workspace') workspace: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BranchDto) {
    return this.trips.retryMessages(await this.trips.scope(uid, workspace, 'Destination', dto.branch), id, dto.branch);
  }
}
