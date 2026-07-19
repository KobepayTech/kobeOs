import {
  Body, Controller, Delete, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { PosysService } from './posys.service';

@UseGuards(JwtAuthGuard)
@Controller('property/posys')
export class PosysController {
  constructor(private readonly svc: PosysService) {}

  // Building map for a single property — floors → corridors → units.
  @Get('properties/:id/map')
  map(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.buildingMap(uid, id);
  }

  // Portfolio-wide health score + collection/occupancy/expense numbers.
  @Get('portfolio-health')
  health(@CurrentUser('id') uid: string) {
    return this.svc.portfolioHealth(uid);
  }

  // Generated insight cards for the dashboard.
  @Get('insights')
  insights(@CurrentUser('id') uid: string) {
    return this.svc.insights(uid);
  }

  // Rent-increase simulator. Pure read-only; doesn't mutate anything.
  @Get('simulate')
  simulate(
    @CurrentUser('id') uid: string,
    @Query('unitCount')      unitCount?: string,
    @Query('currentRevenue') currentRevenue?: string,
    @Query('increasePct')    increasePct?: string,
  ) {
    void uid;
    return this.svc.simulate(
      Number(unitCount)      || 0,
      Number(currentRevenue) || 0,
      Number(increasePct)    || 0,
    );
  }

  // ── Payment tokens ─────────────────────────────────────────────

  @Post('tokens')
  issueToken(
    @CurrentUser('id') uid: string,
    @Body() dto: { tenantId: string; unitId?: string; leaseId?: string; amount: number; currency?: string },
  ) {
    return this.svc.issueToken(uid, dto);
  }

  @Get('tokens')
  listTokens(@CurrentUser('id') uid: string) {
    return this.svc.listTokens(uid);
  }

  // ── Rent dashboard (#2) ────────────────────────────────────────
  @Get('rent-dashboard')
  rentDashboard(@CurrentUser('id') uid: string) {
    return this.svc.rentDashboard(uid);
  }

  @Get('pending-tenants')
  pendingTenants(@CurrentUser('id') uid: string) {
    return this.svc.pendingTenants(uid);
  }

  @Delete('tokens/:id')
  cancelToken(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.cancelToken(uid, id);
  }
}

/**
 * Token lookup + redeem for an agent terminal that doesn't hold the
 * landlord's JWT session. Rate-limited hard so the 6-digit code space
 * (1M entries) can't be brute-forced: 20 lookups per minute per IP,
 * 5 redeems per minute per IP.
 *
 * `lookup` intentionally does NOT mutate — expiry sweeps happen in
 * `listTokens` and are also checked at `redeem` time. That keeps
 * GET idempotent so prefetchers, link-preview crawlers, or generic
 * at-least-once retry middleware can't flip a token to EXPIRED before
 * the cashier's real scan reads it.
 */
@Public()
@Controller('property/tokens')
export class PosysTokensController {
  constructor(private readonly svc: PosysService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':code')
  lookup(@Param('code') code: string) {
    return this.svc.lookupTokenForAgent(code.trim().toUpperCase());
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':code/redeem')
  redeem(
    @Param('code') code: string,
    @Body() dto: { amountReceived: number; agentId?: string },
  ) {
    return this.svc.redeemToken(code.trim().toUpperCase(), dto);
  }
}
