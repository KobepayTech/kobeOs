import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto, RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { Public } from '../common/public.decorator';

@Public()
@Controller('auth')
@Throttle({
  auth: {
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 10,
    ttl: 60_000,
  },
})
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly resets: PasswordResetService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.resets.createToken(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.resets.reset(dto.token, dto.newPassword);
  }

  // ── OAuth (sign in / sign up with Google, TikTok or Meta) ───────────────────

  /** GIS credential from the browser → verified → issues KobeOS tokens. */
  @Post('oauth/google')
  googleOauth(@Body() dto: { credential: string }) {
    return this.auth.googleSignIn(dto?.credential ?? '');
  }

  /** Start TikTok Login — redirects the browser to TikTok's consent screen. */
  @Get('oauth/tiktok')
  tiktokStart(@Res() res: Response) {
    // Never throw inside a @Res() handler — that leaves the browser with a bare
    // 500 and no redirect. If TikTok isn't configured, bounce back to the app
    // with a readable error instead.
    try {
      const state = this.auth.createOAuthState('tiktok');
      res.redirect(this.auth.tiktokAuthUrl(state));
    } catch (e) {
      res.redirect(this.auth.oauthFrontendRedirect('tiktok', e as Error));
    }
  }

  /**
   * TikTok redirects back here with a code. Exchange it, then hand the tokens
   * to the SPA via the URL fragment (never logged/sent to a server).
   */
  @Get('oauth/tiktok/callback')
  async tiktokCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerErrorCode: string,
    @Query('error_description') providerError: string,
    @Res() res: Response,
  ) {
    try {
      this.auth.verifyOAuthState(state, 'tiktok');
      if (providerError || providerErrorCode) throw new Error(providerError || providerErrorCode);
      const tokens = await this.auth.tiktokSignIn(code);
      res.redirect(this.auth.oauthFrontendRedirect('tiktok', tokens));
    } catch (e) {
      res.redirect(this.auth.oauthFrontendRedirect('tiktok', e as Error));
    }
  }

  /** Start Facebook Login, presented in KobeOS as "Continue with Meta". */
  @Get('oauth/meta')
  metaStart(@Res() res: Response) {
    try {
      const state = this.auth.createOAuthState('meta');
      res.redirect(this.auth.metaAuthUrl(state));
    } catch (e) {
      res.redirect(this.auth.oauthFrontendRedirect('meta', e as Error));
    }
  }

  @Get('oauth/meta/callback')
  async metaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerErrorCode: string,
    @Query('error_description') providerError: string,
    @Res() res: Response,
  ) {
    try {
      this.auth.verifyOAuthState(state, 'meta');
      if (providerError || providerErrorCode) throw new Error(providerError || providerErrorCode);
      const tokens = await this.auth.metaSignIn(code);
      res.redirect(this.auth.oauthFrontendRedirect('meta', tokens));
    } catch (e) {
      res.redirect(this.auth.oauthFrontendRedirect('meta', e as Error));
    }
  }
}
