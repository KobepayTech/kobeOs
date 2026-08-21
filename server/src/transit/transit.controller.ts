import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsEmail, IsIn, IsInt, IsNumber,
  IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { TransitService } from './transit.service';

class OperatorDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(100) registrationNumber?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
}

class RouteDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(120) origin!: string;
  @IsString() @MaxLength(120) destination!: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) typicalMinutes?: number;
}

class CheckpointDto {
  @IsOptional() @IsUUID() routeId?: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(40) latitude?: string;
  @IsOptional() @IsString() @MaxLength(40) longitude?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sequence?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minutesToDestination?: number;
}

class CameraDto {
  @IsString() @MaxLength(60) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsUUID() checkpointId?: string;
  @IsOptional() @IsString() @MaxLength(160) location?: string;
  @IsOptional() @IsIn(['ENTRY', 'EXIT', 'BOTH']) direction?: 'ENTRY' | 'EXIT' | 'BOTH';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) confidenceThreshold?: number;
}

class BusDto {
  @IsUUID() operatorId!: string;
  @IsString() @MaxLength(30) plateNumber!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(120) defaultOrigin?: string;
  @IsOptional() @IsString() @MaxLength(120) defaultDestination?: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsString() @MaxLength(160) conductorName?: string;
  @IsOptional() @IsString() @MaxLength(40) conductorPhone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) capacity?: number;
}

class TripDto {
  @IsUUID() busId!: string;
  @IsOptional() @IsUUID() routeId?: string;
  @IsOptional() @IsString() @MaxLength(80) tripCode?: string;
  @IsString() @MaxLength(120) origin!: string;
  @IsString() @MaxLength(120) destination!: string;
  @IsDateString() scheduledDeparture!: string;
  @IsOptional() @IsDateString() scheduledArrival?: string;
  @IsOptional() @IsString() @MaxLength(40) gate?: string;
}

class PolicyDto {
  @Type(() => Number) @IsNumber() @Min(0.01) feeAmount!: number;
  @IsString() @MaxLength(8) currency!: string;
  @Type(() => Number) @IsInt() @Min(1) periodDays!: number;
  @IsOptional() @IsDateString() effectiveAt?: string;
  @Type(() => Number) @IsInt() @Min(0) graceDays!: number;
  @Type(() => Number) @IsInt() @Min(0) dueSoonDays!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) governmentPercent!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) kobePercent!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) automaticAnprThreshold?: number;
}

class PaymentDto {
  @IsUUID() operatorId!: string;
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) busIds!: string[];
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsIn(['MOBILE_MONEY', 'BANK', 'KOBEPAY', 'OTHER']) method!: string;
  @IsString() @MaxLength(160) externalReference!: string;
  @IsString() @MaxLength(160) verificationReference!: string;
  @IsString() @MaxLength(160) idempotencyKey!: string;
}

class DetectionDto {
  @IsUUID() cameraId!: string;
  @IsString() @MaxLength(30) plateNumber!: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) confidence!: number;
  @IsOptional() @IsIn(['ENTRY', 'EXIT', 'BOTH']) direction?: string;
  @IsOptional() @IsUrl({ require_tld: false }) imageUrl?: string;
  @IsOptional() @IsDateString() detectedAt?: string;
}

class SettlementDto {
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
}

class ExemptionDto {
  @IsUUID() busId!: string;
  @IsString() @MaxLength(100) exemptionType!: string;
  @IsString() @MaxLength(160) authority!: string;
  @IsString() @MaxLength(2000) reason!: string;
  @IsDateString() effectiveAt!: string;
  @IsDateString() expiresAt!: string;
  @IsOptional() @IsUrl({ require_tld: false }) supportingDocumentUrl?: string;
}

class DisputeDto {
  @IsUUID() busId!: string;
  @IsString() @MaxLength(160) transactionId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsString() @MaxLength(100) paymentProvider!: string;
  @IsDateString() paymentDate!: string;
  @IsOptional() @IsUrl({ require_tld: false }) receiptUrl?: string;
  @IsString() @MaxLength(3000) explanation!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('transit')
export class TransitController {
  constructor(private readonly transit: TransitService) {}

  @Get('dashboard') dashboard(@CurrentUser('id') uid: string) { return this.transit.dashboard(uid); }
  @Post('compliance/refresh') refresh(@CurrentUser('id') uid: string) { return this.transit.refreshComplianceForOwner(uid); }

  @Get('operators') operators(@CurrentUser('id') uid: string) { return this.transit.listOperators(uid); }
  @Post('operators') createOperator(@CurrentUser('id') uid: string, @Body() dto: OperatorDto) { return this.transit.createOperator(uid, dto); }
  @Get('routes') routes(@CurrentUser('id') uid: string) { return this.transit.listRoutes(uid); }
  @Post('routes') createRoute(@CurrentUser('id') uid: string, @Body() dto: RouteDto) { return this.transit.createRoute(uid, dto); }
  @Get('checkpoints') checkpoints(@CurrentUser('id') uid: string) { return this.transit.listCheckpoints(uid); }
  @Post('checkpoints') createCheckpoint(@CurrentUser('id') uid: string, @Body() dto: CheckpointDto) { return this.transit.createCheckpoint(uid, dto); }
  @Get('cameras') cameras(@CurrentUser('id') uid: string) { return this.transit.listCameras(uid); }
  @Post('cameras') createCamera(@CurrentUser('id') uid: string, @Body() dto: CameraDto) { return this.transit.createCamera(uid, dto); }

  @Get('buses') buses(@CurrentUser('id') uid: string) { return this.transit.listBuses(uid); }
  @Post('buses') createBus(@CurrentUser('id') uid: string, @Body() dto: BusDto) { return this.transit.createBus(uid, dto); }
  @Post('buses/:id/plate') changePlate(@CurrentUser('id') uid: string, @Param('id') id: string, @Body('plateNumber') plateNumber: string) { return this.transit.changePlate(uid, id, plateNumber); }
  @Get('trips') trips(@CurrentUser('id') uid: string) { return this.transit.listTrips(uid); }
  @Post('trips') createTrip(@CurrentUser('id') uid: string, @Body() dto: TripDto) { return this.transit.createTrip(uid, dto as never); }

  @Get('policy') policy(@CurrentUser('id') uid: string) { return this.transit.ensurePolicy(uid); }
  @Post('policy') savePolicy(@CurrentUser('id') uid: string, @Body() dto: PolicyDto) { return this.transit.savePolicy(uid, dto as never); }
  @Post('payments/verify') verifyPayment(@CurrentUser('id') uid: string, @Body() dto: PaymentDto) { return this.transit.recordVerifiedPayment(uid, dto); }

  @Get('detections') detections(@CurrentUser('id') uid: string, @Query('reviewStatus') reviewStatus?: string) { return this.transit.listDetections(uid, reviewStatus); }
  @Post('detections') recordDetection(@CurrentUser('id') uid: string, @Body() dto: DetectionDto) { return this.transit.recordDetection(uid, dto); }
  @Patch('detections/:id/review') reviewDetection(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: { status: 'CONFIRMED' | 'REJECTED'; plateNumber?: string }) { return this.transit.reviewDetection(uid, id, dto); }

  @Get('government/overview') government(@CurrentUser('id') uid: string, @Query() filters: Record<string, string>) { return this.transit.governmentOverview(uid, filters); }
  @Get('government/plates/:plate') plate(@CurrentUser('id') uid: string, @Param('plate') plate: string) { return this.transit.plateDrilldown(uid, plate); }
  @Get('government/settlements') settlements(@CurrentUser('id') uid: string) { return this.transit.listSettlements(uid); }
  @Post('government/settlements') createSettlement(@CurrentUser('id') uid: string, @Body() dto: SettlementDto) { return this.transit.createSettlement(uid, dto); }
  @Post('government/settlements/:id/settle') settle(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: { paymentReference: string; settledAmount?: number }) { return this.transit.settle(uid, id, dto); }
  @Post('government/settlements/:id/reconcile') reconcile(@CurrentUser('id') uid: string, @Param('id') id: string, @Body('note') note?: string) { return this.transit.reconcileSettlement(uid, id, note); }

  @Get('exemptions') exemptions(@CurrentUser('id') uid: string) { return this.transit.listExemptions(uid); }
  @Post('exemptions') createExemption(@CurrentUser('id') uid: string, @CurrentUser('email') actor: string, @Body() dto: ExemptionDto) { return this.transit.createExemption(uid, dto as never, actor); }
  @Patch('exemptions/:id/decision') decideExemption(@CurrentUser('id') uid: string, @CurrentUser('email') actor: string, @Param('id') id: string, @Body('approved') approved: boolean) { return this.transit.decideExemption(uid, id, approved, actor); }
  @Get('disputes') disputes(@CurrentUser('id') uid: string) { return this.transit.listDisputes(uid); }
  @Post('disputes') createDispute(@CurrentUser('id') uid: string, @Body() dto: DisputeDto) { return this.transit.createDispute(uid, dto as never); }
}

@Public()
@Controller('transit-public')
export class TransitPublicController {
  constructor(private readonly transit: TransitService) {}
  @Get(':ownerId/board') board(@Param('ownerId') ownerId: string) { return this.transit.publicBoard(ownerId); }
}
