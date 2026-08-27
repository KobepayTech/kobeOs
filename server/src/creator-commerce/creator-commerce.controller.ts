import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { CreatorCommerceService } from './creator-commerce.service';

const CLICK_COOKIE = 'kobe_click';

/** Authenticated management surface for advertisers/merchants and creators. */
@Controller('creator-commerce')
export class CreatorCommerceController {
  constructor(private readonly svc: CreatorCommerceService) {}

  /** Create an attribution link (usually called by the "Promote With Creators" flow). */
  @Post('links')
  createLink(
    @CurrentUser('id') uid: string,
    @Body() dto: { creatorId: string; campaignId?: string; productId?: string; destination?: 'jumla' | 'store' | 'url'; destinationUrl: string; commissionPercent?: number; promoCode?: string; currency?: string },
  ) {
    return this.svc.createLink({ ...dto, ownerId: uid });
  }

  /** Links this advertiser/merchant owns. */
  @Get('links')
  myLinks(@CurrentUser('id') uid: string) {
    return this.svc.listLinks(uid);
  }

  /** Links belonging to a creator (their own promotion links). */
  @Get('creators/:creatorId/links')
  creatorLinks(@Param('creatorId') creatorId: string) {
    return this.svc.linksForCreator(creatorId);
  }

  /** Commissions owed to a creator, with a per-state summary. */
  @Get('creators/:creatorId/commissions')
  async creatorCommissions(@Param('creatorId') creatorId: string) {
    const [rows, summary] = await Promise.all([
      this.svc.commissionsForCreator(creatorId),
      this.svc.countByState(creatorId),
    ]);
    return { commissions: rows, summary };
  }

  /** Commissions this advertiser/merchant owes. */
  @Get('commissions')
  ownerCommissions(@CurrentUser('id') uid: string) {
    return this.svc.commissionsForOwner(uid);
  }

  /** Creator commerce scorecard (verified sales, conversion, commission split). */
  @Get('creators/:creatorId/stats')
  creatorStats(@Param('creatorId') creatorId: string) {
    return this.svc.creatorStats(creatorId);
  }

  /** Stage this creator's EARNED commissions (from the caller) as PAYABLE. */
  @Post('creators/:creatorId/mark-payable')
  markPayable(@CurrentUser('id') uid: string, @Param('creatorId') creatorId: string) {
    return this.svc.markPayable(uid, creatorId);
  }

  /** Pay out this creator's owed commissions and book the expense. */
  @Post('creators/:creatorId/payout')
  payout(@CurrentUser('id') uid: string, @Param('creatorId') creatorId: string) {
    return this.svc.payoutCreator(uid, creatorId);
  }

  /** Payouts this advertiser/merchant has made. */
  @Get('payouts')
  ownerPayouts(@CurrentUser('id') uid: string) {
    return this.svc.payoutsForOwner(uid);
  }

  /** A creator's received payouts. */
  @Get('creators/:creatorId/payouts')
  creatorPayouts(@Param('creatorId') creatorId: string) {
    return this.svc.payoutsForCreator(creatorId);
  }

  /** Campaign-level performance rollup (clicks → orders → revenue → commission). */
  @Get('campaigns/:campaignId/performance')
  campaignPerformance(@CurrentUser('id') uid: string, @Param('campaignId') campaignId: string) {
    return this.svc.campaignPerformance(uid, campaignId);
  }
}

/**
 * Public click resolver. A creator posts kobe.app/c/<code>; this records the
 * click and 302-redirects to the real destination carrying the attribution
 * code + a persistent click id (cookie + query) so the eventual order attributes
 * back to the creator.
 */
@Public()
@SkipThrottle({ default: true, auth: true, 'public-lookup': true })
@Controller('c')
export class CreatorLinkPublicController {
  constructor(private readonly svc: CreatorCommerceService) {}

  /** Validate a creator discount code (e.g. AMINA10) at checkout — resolves the
   * creator + product so Jumla can show whose code it is. */
  @Get('promo/:code')
  promo(@Param('code') code: string) {
    return this.svc.publicPromoInfo(code);
  }

  /** Safe display info for a link ("Amina's pick") — no redirect, no tracking. */
  @Get(':code/info')
  info(@Param('code') code: string) {
    return this.svc.publicLinkInfo(code);
  }

  @Get(':code')
  async resolve(
    @Param('code') code: string,
    @Query('cid') queryClickId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const existing = queryClickId || (req.cookies?.[CLICK_COOKIE] as string | undefined) || '';
    const resolved = await this.svc.resolveClick(code, existing);
    if (!resolved) {
      // Unknown/inactive code — send them to the Jumla home rather than erroring.
      res.redirect(302, '/jumla');
      return;
    }
    // 90-day attribution window; lax so it survives the cross-site click through.
    res.cookie(CLICK_COOKIE, resolved.clickId, { maxAge: 90 * 24 * 60 * 60 * 1000, httpOnly: false, sameSite: 'lax' });
    res.redirect(302, resolved.url);
  }
}
