import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { LiveSaleService } from './live-sale.service';
import { InstagramService } from './instagram.service';

class StartSessionDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() currency?: string;
  /** 'live' (default) or 'post' for an ad/post campaign. */
  @IsOptional() @IsString() kind?: string;
  /** For a post campaign: the ad/post URL whose comments Apify polls. */
  @IsOptional() @IsString() @MaxLength(500) postUrl?: string;
  @IsOptional() @IsUUID() socialAccountId?: string;
}
class PinDto {
  @IsUUID() productId!: string;
  @IsString() @MaxLength(24) code!: string;
  @IsOptional() @IsNumber() @Min(0) livePrice?: number;
}
class IngestDto {
  @IsString() @MaxLength(1000) text!: string;
  @IsOptional() @IsString() @MaxLength(80) buyerHandle?: string;
  @IsOptional() @IsString() @MaxLength(40) buyerContact?: string;
  @IsOptional() @IsString() source?: string;
}
class ConvertDto {
  @IsOptional() @IsNumber() @Min(1) qty?: number;
  @IsOptional() @IsString() @MaxLength(40) buyerContact?: string;
  @IsOptional() @IsString() @MaxLength(24) code?: string;
}

type RawBodyRequest = Request & { rawBody?: Buffer };

@UseGuards(JwtAuthGuard)
@Controller('live-sales')
export class LiveSaleController {
  constructor(
    private readonly svc: LiveSaleService,
    private readonly instagram: InstagramService,
  ) {}

  @Get() list(@CurrentUser('id') uid: string) { return this.svc.listSessions(uid); }
  @Post() async start(@CurrentUser('id') uid: string, @Body() dto: StartSessionDto) {
    const socialAccountId = await this.instagram.resolveSessionAccount(uid, dto.platform, dto.socialAccountId);
    return this.svc.startSession(uid, { ...dto, socialAccountId });
  }
  @Get('operator/context') context(@CurrentUser('id') uid: string) { return this.svc.operatorContext(uid); }

  @Get('instagram/connection') instagramConnection(@CurrentUser('id') uid: string) {
    return this.instagram.getConnection(uid);
  }

  @Get('instagram/oauth/url') instagramOauthUrl(@CurrentUser('id') uid: string) {
    return this.instagram.getOAuthUrl(uid);
  }

  @Post('instagram/webhook/subscribe') retryInstagramWebhook(@CurrentUser('id') uid: string) {
    return this.instagram.retryWebhookSubscription(uid);
  }

  @Delete('instagram/connection') disconnectInstagram(@CurrentUser('id') uid: string) {
    return this.instagram.disconnect(uid);
  }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.getSession(uid, id); }
  @Post(':id/end') end(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.endSession(uid, id); }
  @Post(':id/storefront') storefront(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: { show: boolean }) { return this.svc.setStorefront(uid, id, !!dto.show); }
  @Get(':id/stats') stats(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.stats(uid, id); }

  @Get(':id/pins') pins(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.listPins(uid, id); }
  @Post(':id/pins') pin(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: PinDto) { return this.svc.pinProduct(uid, id, dto); }
  @Delete(':id/pins/:pinId') unpin(@CurrentUser('id') uid: string, @Param('id') id: string, @Param('pinId') pinId: string) { return this.svc.unpin(uid, id, pinId); }
  @Post(':id/featured') featured(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: { pinId: string }) { return this.svc.setFeatured(uid, id, dto?.pinId); }

  @Get('sales/feed') salesFeed(@CurrentUser('id') uid: string) { return this.svc.salesFeed(uid); }

  @Get(':id/comments') comments(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.listComments(uid, id); }
  @Post(':id/comments') ingest(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: IngestDto) { return this.svc.ingestComment(uid, id, dto); }
  @Post('comments/:commentId/convert') convert(@CurrentUser('id') uid: string, @Param('commentId') commentId: string, @Body() dto: ConvertDto) { return this.svc.convert(uid, commentId, dto); }
  @Post('comments/:commentId/ignore') ignore(@CurrentUser('id') uid: string, @Param('commentId') commentId: string) { return this.svc.ignoreComment(uid, commentId); }
}

/**
 * Public bridge ingest. An external comment-forwarder (e.g. a TikTok-Live
 * bridge the operator runs themselves) POSTs comments here using the
 * session's ingestToken — no JWT. The token is the capability.
 */
@Public()
@Controller('live-sales/ingest')
export class LiveSaleIngestController {
  constructor(private readonly svc: LiveSaleService) {}

  @Post(':token')
  ingest(@Param('token') token: string, @Body() dto: IngestDto) {
    return this.svc.ingestByToken(token, dto);
  }
}

/** Public: the active shoppable live for a storefront slug (drives the
 *  "LIVE" banner on the online shop). */
@Public()
@Controller('live-sales/public')
export class LiveSalePublicController {
  constructor(
    private readonly svc: LiveSaleService,
    private readonly instagram: InstagramService,
  ) {}

  @Get(':slug')
  live(@Param('slug') slug: string) { return this.svc.publicLive(slug); }

  /** Buyer's checkout page for a live reservation (opened from the DM link). */
  @Get('checkout/:token')
  checkout(@Param('token') token: string) { return this.svc.checkoutByToken(token); }

  /** Buyer confirms & pays their live reservation from the checkout page. */
  @Post('checkout/:token/pay')
  pay(@Param('token') token: string, @Body() dto: { buyerContact?: string }) {
    return this.svc.payByToken(token, { buyerContact: dto?.buyerContact });
  }

  /** Reserve a product straight from the live catalog (method 1). */
  @Post(':slug/reserve')
  reserve(@Param('slug') slug: string, @Body() dto: { code: string; qty?: number; buyerHandle?: string; variation?: string }) {
    return this.svc.reserveFromCatalog(slug, dto);
  }

  /** Pull up a reservation by its short code (method 2 — moderator's K7Q4). */
  @Get('reservation/:code')
  reservation(@Param('code') code: string) {
    return this.svc.checkoutByCode(code);
  }

  /** Instagram Graph API `live_comments` webhook — Meta's verification GET. */
  @Get('webhooks/instagram')
  igVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (this.instagram.verifyWebhook(mode, token)) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('forbidden');
    }
  }

  /** Instagram live comments delivered by the Graph API webhook. */
  @Post('webhooks/instagram')
  igEvent(
    @Body() body: unknown,
    @Req() req: RawBodyRequest,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    return this.instagram.handleWebhook(body, req.rawBody, signature);
  }
}

/** Public OAuth callback and webhook endpoint used by Meta's Instagram API. */
@Public()
@Controller('live-sales/instagram')
export class LiveSaleInstagramPublicController {
  constructor(private readonly instagram: InstagramService) {}

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const redirect = new URL(this.instagram.frontendRedirectUrl());
    try {
      if (error) throw new Error(errorDescription || error);
      const result = await this.instagram.completeOAuth(code, state);
      redirect.searchParams.set('instagram', 'connected');
      if (!result.webhookSubscribed) redirect.searchParams.set('instagram_webhook', 'not_subscribed');
    } catch (e) {
      redirect.searchParams.set('instagram', 'error');
      redirect.searchParams.set('message', (e as Error).message || 'Instagram connection failed');
    }
    res.redirect(redirect.toString());
  }

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (this.instagram.verifyWebhook(mode, token)) res.status(200).send(challenge);
    else res.status(403).send('forbidden');
  }

  @Post('webhook')
  webhook(
    @Body() body: unknown,
    @Req() req: RawBodyRequest,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    return this.instagram.handleWebhook(body, req.rawBody, signature);
  }

  @Post('deauthorize')
  deauthorize(@Body('signed_request') signedRequest: string) {
    return this.instagram.handleDeauthorize(signedRequest);
  }

  @Post('data-deletion')
  dataDeletion(@Body('signed_request') signedRequest: string) {
    return this.instagram.handleDataDeletion(signedRequest);
  }
}
