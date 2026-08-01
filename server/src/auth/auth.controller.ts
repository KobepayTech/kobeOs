import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
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
@Throttle({ auth: { limit: 10, ttl: 60_000 } })
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

  // ── OAuth (sign in / sign up with Google or TikTok) ─────────────────────────

  /** GIS credential from the browser → verified → issues KobeOS tokens. */
  @Post('oauth/google')
  googleOauth(@Body() dto: { credential: string }) {
    return this.auth.googleSignIn(dto?.credential ?? '');
  }

  /** Start TikTok Login — redirects the browser to TikTok's consent screen. */
  @Get('oauth/tiktok')
  tiktokStart(@Res() res: Response) {
    const state = randomBytes(12).toString('hex');
    res.redirect(this.auth.tiktokAuthUrl(state));
  }

  /**
   * TikTok redirects back here with a code. Exchange it, then hand the tokens
   * to the SPA via the URL fragment (never logged/sent to a server).
   */
  @Get('oauth/tiktok/callback')
  async tiktokCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const tokens = await this.auth.tiktokSignIn(code);
      const frag = new URLSearchParams({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }).toString();
      res.redirect(`/oauth/tiktok#${frag}`);
    } catch (e) {
      res.redirect(`/oauth/tiktok#error=${encodeURIComponent((e as Error).message)}`);
    }
  }
}
