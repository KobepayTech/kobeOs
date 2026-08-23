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

@Public()
@Controller('social-scheduler/tiktok')
export class TikTokPublicController {
  constructor(private readonly tiktok: TikTokService) {}

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerErrorCode: string,
    @Query('error_description') providerError: string,
    @Res() res: Response,
  ) {
    const redirect = new URL(this.tiktok.frontendRedirectUrl());
    try {
      if (providerError || providerErrorCode) throw new Error(providerError || providerErrorCode);
      await this.tiktok.completeOAuth(code, state);
      redirect.searchParams.set('tiktok', 'connected');
    } catch (error) {
      redirect.searchParams.set('tiktok', 'error');
      redirect.searchParams.set('message', (error as Error).message || 'TikTok connection failed');
    }
    res.redirect(redirect.toString());
  }
}
