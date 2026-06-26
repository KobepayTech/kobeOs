import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MzigoService } from './mzigo.service';

/** Synthetic ownerId used to attribute manifests submitted via the
 *  public /mzigo page (warehouse clerks don't have JWT logins, by
 *  design). Group all anonymous submissions under one bucket so they
 *  can be filtered later if a back-office wants to claim them. */
const PUBLIC_OWNER_ID = '00000000-0000-0000-0000-00000000mzg0';

/**
 * Mostly-public Kobe Mzigo endpoints. The packager + agent +
 * destination flows are public because actual real-world cargo
 * desks don't have time to onboard a JWT login for every clerk.
 * Truck loading + dispatch is operator-authed.
 */
@Controller('mzigo')
export class MzigoController {
  constructor(private readonly svc: MzigoService) {}

  // ── Companies + Agents (public read; throttled writes) ─────────
  @Get('companies') listCompanies() { return this.svc.listCompanies(); }
  // Rate-limit creation so a bad actor can't spam-register thousands
  // of phantom cargo companies from the public admin page.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('companies') createCompany(@Body() dto: { name: string; phone?: string; headOffice?: string }) {
    return this.svc.createCompany(dto);
  }
  @Get('agents') listAgents(@Query('companyId') companyId?: string) { return this.svc.listAgents(companyId); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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

/** Public truck operations — loading, dispatching, and the
 *  destination scan-plate receive. The /mzigo public page is the
 *  intended UI and warehouse clerks do not have JWT logins by
 *  design; manifests are attributed to a synthetic PUBLIC_OWNER_ID
 *  bucket so a back-office can claim them later. */
@Controller('mzigo/trucks')
export class MzigoTrucksController {
  constructor(private readonly svc: MzigoService) {}

  @Post('load')
  load(
    @Body() dto: { waybills: string[]; truckPlate: string; driverName: string; driverPhone: string; origin: string; destination: string },
  ) { return this.svc.loadOntoTruck(PUBLIC_OWNER_ID, dto); }

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
