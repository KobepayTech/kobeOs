import { Body, Controller, ForbiddenException, Get, HttpException, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService, type IssuedTokens } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto, RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { Public } from '../common/public.decorator';

type CloudAuthResponse = {
  accessToken: string;
  refreshToken: string;
  user?: {
    id?: string;
    email?: string;
    phone?: string | null;
    displayName?: string;
    avatarUrl?: string | null;
  };
};

type CloudProfile = {
  id?: string;
  email?: string;
  phone?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
};

type DesktopAuthResponse = IssuedTokens & {
  cloudAccessToken: string;
  cloudRefreshToken: string;
};

/**
 * Raised when Kobe Cloud cannot be reached at all (DNS/TLS/timeout or an
 * upstream gateway error) — as opposed to the cloud answering with an
 * authoritative 4xx (e.g. "email already registered", "wrong password").
 * Only the former should fall back to a purely local account; the latter is a
 * real answer we must surface to the user.
 */
class CloudUnavailableError extends Error {}

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

  // ── Desktop account bridge ─────────────────────────────────────────────────
  // The desktop renderer must never contain Meta/TikTok client secrets. It
  // authenticates against the public Kobe Cloud account service, then exchanges
  // the verified cloud identity for a local KobeOS JWT that the embedded API can
  // trust. This keeps one global Kobe account while preserving the offline-first
  // local backend security boundary.

  private assertDesktopBridge(): void {
    if (process.env.KOBEOS_DESKTOP !== 'true') {
      throw new ForbiddenException('Desktop account bridge is only available inside KobeOS Desktop');
    }
  }

  private cloudBase(): string {
    return (process.env.KOBE_CLOUD_API || 'https://api.kobeapptz.com/api').replace(/\/$/, '');
  }

  private async cloudRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.cloudBase()}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!response) {
      throw new CloudUnavailableError('Kobe Cloud is unreachable');
    }

    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      // Gateway-class failures mean the cloud service itself is down/unreachable,
      // not that the request was rejected — treat them like a network failure so
      // the desktop can still fall back to a local account.
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new CloudUnavailableError(`Kobe Cloud returned HTTP ${response.status}`);
      }
      const rawMessage = body.message ?? body.error;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : `Kobe Cloud returned HTTP ${response.status}`;
      throw new HttpException(message, response.status);
    }
    return body as T;
  }

  /** Wrap a local IssuedTokens result in the desktop response shape. A locally
   * created account has no cloud session yet; the tokens sync on the next
   * successful cloud sign-in. */
  private localOnly(local: IssuedTokens): DesktopAuthResponse {
    return { ...local, cloudAccessToken: '', cloudRefreshToken: '' };
  }

  private async exchangeCloudIdentity(
    cloudAccessToken: string,
    cloudRefreshToken = '',
  ): Promise<DesktopAuthResponse> {
    if (!cloudAccessToken) throw new UnauthorizedException('Missing Kobe Cloud access token');

    const profile = await this.cloudRequest<CloudProfile>('/users/me', {
      headers: { Authorization: `Bearer ${cloudAccessToken}` },
    }).catch((e) => {
      // A social sign-in can only be verified by the cloud — there is no local
      // fallback, so present unreachability as a clean 503.
      if (e instanceof CloudUnavailableError) {
        throw new HttpException('Kobe Cloud is unavailable. Check the internet connection and try again.', 503);
      }
      throw e;
    });
    if (!profile?.email) throw new UnauthorizedException('Kobe Cloud account has no verified email');

    const local = await this.auth.oauthSignIn({
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
    });

    return {
      ...local,
      cloudAccessToken,
      cloudRefreshToken,
    };
  }

  @Get('desktop/cloud-status')
  async desktopCloudStatus() {
    this.assertDesktopBridge();
    try {
      const version = await this.cloudRequest<Record<string, unknown>>('/system/version');
      return { reachable: true, cloud: version };
    } catch (e) {
      if (e instanceof CloudUnavailableError) return { reachable: false };
      throw e;
    }
  }

  @Post('desktop/register')
  async desktopRegister(@Body() dto: RegisterDto) {
    this.assertDesktopBridge();
    try {
      const cloud = await this.cloudRequest<CloudAuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      return this.exchangeCloudIdentity(cloud.accessToken, cloud.refreshToken);
    } catch (e) {
      // Self-hosted / offline: if Kobe Cloud can't be reached, create the
      // account directly against the embedded backend so the OS is fully
      // usable. A cloud rejection (email taken, invalid input) is authoritative
      // and rethrown.
      if (e instanceof CloudUnavailableError) return this.localOnly(await this.auth.register(dto));
      throw e;
    }
  }

  @Post('desktop/login')
  async desktopLogin(@Body() dto: LoginDto) {
    this.assertDesktopBridge();
    try {
      const cloud = await this.cloudRequest<CloudAuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      return this.exchangeCloudIdentity(cloud.accessToken, cloud.refreshToken);
    } catch (e) {
      // Fall back to the local account when the cloud is unreachable so an
      // already-provisioned desktop user can still sign in offline.
      if (e instanceof CloudUnavailableError) return this.localOnly(await this.auth.login(dto));
      throw e;
    }
  }

  @Post('desktop/google')
  async desktopGoogle(@Body() dto: { credential?: string }) {
    this.assertDesktopBridge();
    const cloud = await this.cloudRequest<CloudAuthResponse>('/auth/oauth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: dto?.credential ?? '' }),
    });
    return this.exchangeCloudIdentity(cloud.accessToken, cloud.refreshToken);
  }

  @Post('desktop/exchange')
  async desktopExchange(@Body() dto: { accessToken?: string; refreshToken?: string }) {
    this.assertDesktopBridge();
    return this.exchangeCloudIdentity(dto?.accessToken ?? '', dto?.refreshToken ?? '');
  }

  @Post('desktop/forgot-password')
  async desktopForgotPassword(@Body() dto: ForgotPasswordDto) {
    this.assertDesktopBridge();
    try {
      return await this.cloudRequest<{ ok: true; resetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    } catch (e) {
      if (e instanceof CloudUnavailableError) return this.resets.createToken(dto.email);
      throw e;
    }
  }

  @Post('desktop/reset-password')
  async desktopResetPassword(@Body() dto: ResetPasswordDto) {
    this.assertDesktopBridge();
    try {
      return await this.cloudRequest<{ ok: true }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    } catch (e) {
      if (e instanceof CloudUnavailableError) return this.resets.reset(dto.token, dto.newPassword);
      throw e;
    }
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
  async metaStart(@Res() res: Response) {
    try {
      const state = this.auth.createOAuthState('meta');
      res.redirect(await this.auth.metaAuthUrl(state));
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
