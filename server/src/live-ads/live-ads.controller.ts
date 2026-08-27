import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { LiveAdsService } from './live-ads.service';

/** Advertiser / creator / admin management surface (JWT-guarded globally). */
@Controller('live-ads')
export class LiveAdsController {
  constructor(private readonly svc: LiveAdsService) {}

  // Creator identity + session
  @Post('identity')
  ensureIdentity(@CurrentUser('id') uid: string, @Body() dto: { creatorId: string; handle?: string }) {
    return this.svc.ensureIdentity(uid, dto.creatorId, dto.handle);
  }
  @Post('identity/rename')
  rename(@CurrentUser('id') uid: string, @Body() dto: { creatorId: string; handle: string }) {
    return this.svc.renameHandle(uid, dto.creatorId, dto.handle);
  }
  @Post('sessions/start')
  startSession(@CurrentUser('id') uid: string, @Body() dto: { creatorId: string }) {
    return this.svc.startManualSession(uid, dto.creatorId);
  }
  @Post('sessions/end')
  stopSession(@CurrentUser('id') uid: string, @Body() dto: { creatorId: string }) {
    return this.svc.stopManualSession(uid, dto.creatorId);
  }

  // Advertiser destinations (server-side, approved)
  @Get('destinations')
  destinations(@CurrentUser('id') uid: string) { return this.svc.listDestinations(uid); }
  @Post('destinations')
  createDestination(@CurrentUser('id') uid: string, @Body() dto: { url: string }) {
    return this.svc.createDestination(uid, dto.url);
  }
  @Post('destinations/:id/disable')
  disableDestination(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.setDestinationStatus(uid, id, 'DISABLED');
  }
  @Post('destinations/:id/enable')
  enableDestination(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.setDestinationStatus(uid, id, 'ACTIVE');
  }

  // Campaigns
  @Post('campaigns')
  createCampaign(@CurrentUser('id') uid: string, @Body() dto: Parameters<LiveAdsService['createCampaign']>[1]) {
    return this.svc.createCampaign(uid, dto);
  }
  @Post('campaigns/:id/submit')
  submit(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.submitCampaign(uid, id); }
  @Post('campaigns/:id/pause')
  pause(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.setCampaignStatus(uid, id, 'PAUSED'); }
  @Post('campaigns/:id/resume')
  resume(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.setCampaignStatus(uid, id, 'APPROVED'); }
  @Get('campaigns/mine')
  myCampaigns(@CurrentUser('id') uid: string) { return this.svc.listCampaigns(uid); }
  @Get('campaigns/:id/stats')
  campaignStats(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.campaignAdStats(uid, id); }

  // Admin approval + kill-switch
  @Roles('admin')
  @Post('campaigns/:id/approve')
  approve(@Param('id') id: string, @Body() dto: { note?: string }) { return this.svc.reviewCampaign(id, true, dto?.note); }
  @Roles('admin')
  @Post('campaigns/:id/reject')
  reject(@Param('id') id: string, @Body() dto: { note?: string }) { return this.svc.reviewCampaign(id, false, dto?.note); }
  @Roles('admin')
  @Post('campaigns/:id/emergency-stop')
  emergencyStop(@Param('id') id: string) { return this.svc.emergencyStop(id); }

  // Slots
  @Post('slots')
  startSlot(@CurrentUser('id') uid: string, @Body() dto: { creatorId: string; campaignId: string; playbackSeconds?: number; ctaSeconds?: number }) {
    return this.svc.startSlot(uid, dto.creatorId, dto);
  }
  @Post('slots/:id/end')
  endSlot(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.endSlot(uid, id); }

  // Auto-delivery rotation (app listens for live + delivers ads on a cadence)
  @Get('creators/:creatorId/rotation')
  getRotation(@CurrentUser('id') uid: string, @Param('creatorId') creatorId: string) { return this.svc.getRotation(uid, creatorId); }
  @Post('creators/:creatorId/rotation')
  setRotation(@CurrentUser('id') uid: string, @Param('creatorId') creatorId: string, @Body() dto: { campaignIds: string[]; everySeconds?: number; playbackSeconds?: number; ctaSeconds?: number; active?: boolean }) {
    return this.svc.setRotation(uid, creatorId, dto);
  }

  // Creator scorecard
  @Get('creators/:creatorId/stats')
  creatorStats(@Param('creatorId') creatorId: string) { return this.svc.creatorAdStats(creatorId); }
}

/**
 * Public edge: the permanent link, slot QR, click-through redirect, and the
 * overlay/broadcaster session endpoints. No JWT — identified by handle / code /
 * overlay token.
 */
@Public()
@SkipThrottle({ default: true, auth: true, 'public-lookup': true })
@Controller('live')
export class LiveAdsPublicController {
  constructor(private readonly svc: LiveAdsService) {}

  /** kobe.live/@handle → current sponsor state (or the creator page). */
  @Get('resolve/:handle')
  resolve(@Param('handle') handle: string) { return this.svc.resolveBio(handle); }

  /** Slot-exact QR (kobe.live/a/<code>) → precise attribution to that sponsor. */
  @Get('a/:code')
  qr(@Param('code') code: string) { return this.svc.resolveQr(code); }

  /** Click-through: re-validates at click time, then 302s to the approved URL. */
  @Get('go/:clickVisitId')
  async go(@Param('clickVisitId') clickVisitId: string, @Res() res: Response) {
    const result = await this.svc.clickThrough(clickVisitId);
    // A stopped campaign / disabled destination falls back to Jumla, never an
    // advertiser-supplied URL.
    res.redirect(302, result?.url ?? '/jumla');
  }

  // Overlay / Kobe Broadcaster session control
  @Get('overlay/:token/state')
  overlayState(@Param('token') token: string) { return this.svc.overlayState(token); }
  @Post('overlay/:token/heartbeat')
  heartbeat(@Param('token') token: string) { return this.svc.heartbeat(token); }
  @Post('overlay/:token/end')
  end(@Param('token') token: string) { return this.svc.endSession(token); }
  @Post('overlay/:token/impression')
  impression(@Param('token') token: string, @Body() dto: { slotId: string }) { return this.svc.recordImpression(token, dto.slotId); }
}
