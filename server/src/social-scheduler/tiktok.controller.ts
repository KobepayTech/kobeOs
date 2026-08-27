import { Body, Controller, Delete, Get, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { TikTokService } from './tiktok.service';

@UseGuards(JwtAuthGuard)
@Controller('social-scheduler/tiktok')
export class TikTokController {
  constructor(private readonly tiktok: TikTokService) {}

  @Get('connection')
  connection(@CurrentUser('id') uid: string) {
    return this.tiktok.getConnection(uid);
  }

  @Get('oauth/url')
  oauthUrl(@CurrentUser('id') uid: string) {
    return this.tiktok.getOAuthUrl(uid);
  }

  @Post('refresh')
  refresh(@CurrentUser('id') uid: string) {
    return this.tiktok.refresh(uid);
  }

  @Put('preferences')
  preferences(@CurrentUser('id') uid: string, @Body() body: { privacyLevel?: string }) {
    return this.tiktok.setPreferences(uid, String(body?.privacyLevel || ''));
  }

  @Delete('connection')
  disconnect(@CurrentUser('id') uid: string) {
    return this.tiktok.disconnect(uid);
  }
}

/** Shared TikTok OAuth callback: exchange the code, then bounce back to the app. */
async function completeTikTokCallback(
  tiktok: TikTokService, res: Response,
  params: { code: string; state: string; providerErrorCode?: string; providerError?: string },
) {
  const redirect = new URL(tiktok.frontendRedirectUrl());
  try {
    if (params.providerError || params.providerErrorCode) throw new Error(params.providerError || params.providerErrorCode);
    await tiktok.completeOAuth(params.code, params.state);
    redirect.searchParams.set('tiktok', 'connected');
  } catch (error) {
    redirect.searchParams.set('tiktok', 'error');
    redirect.searchParams.set('message', (error as Error).message || 'TikTok connection failed');
  }
  res.redirect(redirect.toString());
}

@Public()
@Controller('social-scheduler/tiktok')
export class TikTokPublicController {
  constructor(private readonly tiktok: TikTokService) {}

  @Get('oauth/callback')
  oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerErrorCode: string,
    @Query('error_description') providerError: string,
    @Res() res: Response,
  ) {
    return completeTikTokCallback(this.tiktok, res, { code, state, providerErrorCode, providerError });
  }
}

/**
 * Alias callback at the canonical integrations path
 * (https://creator.kobeapptz.com/api/integrations/tiktok/callback) so the TikTok
 * app can register that redirect URI. Same flow as the social-scheduler callback.
 */
@Public()
@Controller('integrations/tiktok')
export class TikTokIntegrationsController {
  constructor(private readonly tiktok: TikTokService) {}

  @Get('callback')
  callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerErrorCode: string,
    @Query('error_description') providerError: string,
    @Res() res: Response,
  ) {
    return completeTikTokCallback(this.tiktok, res, { code, state, providerErrorCode, providerError });
  }
}
