import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MzigoService } from './mzigo.service';

/**
 * Mostly-public Kobe Mzigo endpoints. The packager + agent +
 * destination flows are public because actual real-world cargo
 * desks don't have time to onboard a JWT login for every clerk.
 * Truck loading + dispatch is operator-authed.
 */
@Controller('mzigo')
export class MzigoController {
  constructor(private readonly svc: MzigoService) {}

  // ── Companies + Agents (public read) ───────────────────────────
  @Get('companies') listCompanies() { return this.svc.listCompanies(); }
  @Post('companies') createCompany(@Body() dto: { name: string; phone?: string; headOffice?: string }) {
    return this.svc.createCompany(dto);
  }
  @Get('agents') listAgents(@Query('companyId') companyId?: string) { return this.svc.listAgents(companyId); }
  @Post('agents') createAgent(@Body() dto: { companyId: string; name: string; phone: string; area?: string }) {
    return this.svc.createAgent(dto);
  }

  // ── Role 1: Packager registers a parcel ────────────────────────
  @Post('parcels')
  register(@Body() dto: Parameters<MzigoService['register']>[0]) {
    return this.svc.register(dto);
  }

  // ── Role 2: Agent endpoints ────────────────────────────────────
  @Get('parcels/open') listOpen() { return this.svc.listOpenForAgent(); }
  @Get('agents/:id/assignments') myAssignments(@Param('id') id: string) {
    return this.svc.listMyAssignments(id);
  }
  @Post('parcels/:waybill/claim') claim(
    @Param('waybill') waybill: string,
    @Body() dto: { agentId: string },
  ) { return this.svc.claimParcel(waybill, dto.agentId); }

  @Post('parcels/:waybill/picked-up') pickedUp(
    @Param('waybill') waybill: string,
    @Body() dto: { agentId: string },
  ) { return this.svc.markPickedUp(waybill, dto.agentId); }

  // ── Role 3: Warehouse + truck loading ──────────────────────────
  @Get('warehouse/queue') warehouseQueue() { return this.svc.listAtWarehouse(); }
  @Post('parcels/:waybill/at-warehouse') atWarehouse(@Param('waybill') waybill: string) {
    return this.svc.markAtWarehouse(waybill);
  }
}

/** Operator-authed truck operations — loading, dispatching, and
 *  the destination scan-plate receive. */
@UseGuards(JwtAuthGuard)
@Controller('mzigo/trucks')
export class MzigoTrucksController {
  constructor(private readonly svc: MzigoService) {}

  @Post('load')
  load(
    @CurrentUser('id') uid: string,
    @Body() dto: { waybills: string[]; truckPlate: string; driverName: string; driverPhone: string; origin: string; destination: string },
  ) { return this.svc.loadOntoTruck(uid, dto); }

  @Post(':plate/dispatch')
  dispatch(@Param('plate') plate: string) { return this.svc.dispatchTruck(plate); }

  @Post(':plate/receive')
  receive(@Param('plate') plate: string) { return this.svc.receiveTruck(plate); }

  @Get(':plate/parcels')
  parcels(@Param('plate') plate: string) { return this.svc.listParcelsOnTruck(plate); }
}

/** Public tracking — any waybill, no auth. */
@Controller('mzigo-track')
export class MzigoTrackingController {
  constructor(private readonly svc: MzigoService) {}

  @Get(':waybill')
  track(@Param('waybill') waybill: string) { return this.svc.track(waybill); }

  @Post(':waybill/collected')
  collected(@Param('waybill') waybill: string, @Body() dto?: { collectedByName?: string }) {
    return this.svc.markCollected(waybill, dto?.collectedByName);
  }
}
