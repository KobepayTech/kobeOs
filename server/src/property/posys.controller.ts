import {
  Body, Controller, Delete, Get, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
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

  @Delete('tokens/:id')
  cancelToken(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.cancelToken(uid, id);
  }
}

/**
 * Token lookup + redeem live on a separate, optionally-authed
 * controller so an agent terminal can verify a token without holding
 * the landlord's session.
 */
@Controller('property/tokens')
export class PosysTokensController {
  constructor(private readonly svc: PosysService) {}

  @Get(':code')
  lookup(@Param('code') code: string) {
    return this.svc.lookupToken(code.trim().toUpperCase());
  }

  @Post(':code/redeem')
  redeem(
    @Param('code') code: string,
    @Body() dto: { amountReceived: number; agentId?: string },
  ) {
    return this.svc.redeemToken(code.trim().toUpperCase(), dto);
  }
}
