import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CargoConsolidationService } from './cargo-consolidation.service';
import { ConsolidationBoxStatus } from './cargo.entity';

/**
 * REST surface for the upgraded cargo flow (BubbleBee-style):
 *
 *   /cargo/customers       — registry + 3-char displayId generator
 *   /cargo/lanes           — pre-configured shipping lanes
 *   /cargo/boxes           — consolidation boxes (parcel → box → shipment)
 */
@UseGuards(JwtAuthGuard)
@Controller('cargo')
export class CargoConsolidationController {
  constructor(private readonly svc: CargoConsolidationService) {}

  // ── Customers ───────────────────────────────────────────────────────────
  @Get('customers')
  listCustomers(@CurrentUser('id') uid: string) { return this.svc.listCustomers(uid); }

  @Post('customers')
  createCustomer(
    @CurrentUser('id') uid: string,
    @Body() dto: { name: string; phone: string; country?: string; notes?: string },
  ) { return this.svc.createCustomer(uid, dto); }

  // ── Lanes ───────────────────────────────────────────────────────────────
  @Get('lanes')
  listLanes(@CurrentUser('id') uid: string) { return this.svc.listLanes(uid); }

  @Post('lanes')
  createLane(
    @CurrentUser('id') uid: string,
    @Body() dto: { code: string; name: string; origin?: string; destination?: string; defaultCarrier?: string; defaultAirlineCode?: string; dispatchDays?: string[]; pricePerKg?: number; currency?: string },
  ) { return this.svc.createLane(uid, dto); }

  // ── Consolidation boxes ─────────────────────────────────────────────────
  @Get('boxes')
  listBoxes(
    @CurrentUser('id') uid: string,
    @Query('status') status?: ConsolidationBoxStatus,
  ) { return this.svc.listBoxes(uid, status); }

  @Post('boxes')
  createBox(
    @CurrentUser('id') uid: string,
    @Body() dto: { laneId: string; boxId?: string; notes?: string },
  ) { return this.svc.createBox(uid, dto); }

  @Post('boxes/:id/assign')
  assign(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { parcelIds: string[] },
  ) { return this.svc.assignParcels(uid, id, dto.parcelIds); }

  @Post('boxes/:id/unassign')
  unassign(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { parcelIds: string[] },
  ) { return this.svc.unassignParcels(uid, id, dto.parcelIds); }

  @Post('boxes/:id/seal')
  seal(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { sealedBy?: string },
  ) { return this.svc.sealBox(uid, id, dto.sealedBy ?? ''); }

  @Post('boxes/:id/dispatch')
  dispatch(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: { shipmentId?: string; carrier?: string; flightNumber?: string },
  ) { return this.svc.dispatchBox(uid, id, dto); }

  @Post('boxes/:id/receive')
  receiveOverseas(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) { return this.svc.receiveOverseas(uid, id); }
}
