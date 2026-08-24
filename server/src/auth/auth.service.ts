import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './refresh-token.entity';
import type { User } from '../users/user.entity';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizePhone(input: string): string {
  const phone = input.trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (!/^\+?\d{7,15}$/.test(phone)) {
    throw new BadRequestException('Enter a valid phone number with 7–15 digits');
  }
  return phone;
}

function internalEmailForPhone(phone: string): string {
  return `phone_${sha256(phone).slice(0, 40)}@phone.kobeos.local`;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; phone?: string | null; displayName?: string; role: User['role'] };
}

type OAuthProvider = 'tiktok' | 'meta';
type OAuthState = { provider: OAuthProvider; nonce: string; exp: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedTokens> {
    const email = dto.email?.trim().toLowerCase() || '';
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    if (!email && !phone) throw new BadRequestException('Provide an email address or phone number');
    if (email && await this.users.findByEmail(email)) throw new ConflictException('Email already registered');
    if (phone && await this.users.findByPhone(phone)) throw new ConflictException('Phone number already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: email || internalEmailForPhone(phone!),
      phone,
      passwordHash,
      displayName: dto.displayName ?? (email ? email.split('@')[0] : 'KobeOS user'),
    });
    return this.issue(user.id, user.email, user.displayName, user.role, user.phone);
  }

  async login(dto: LoginDto): Promise<IssuedTokens> {
    const identifier = (dto.identifier ?? dto.email ?? dto.phone ?? '').trim();
    if (!identifier) throw new BadRequestException('Provide an email address or phone number');
    const user = identifier.includes('@')
      ? await this.users.findByEmail(identifier)
      : await this.users.findByPhone(normalizePhone(identifier));
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user.id, user.email, user.displayName, user.role, user.phone);
  }

  /**
   * Sign in (or transparently create) a user from a verified OAuth profile.
   * OAuth accounts have no usable password (a random hash is stored), so they
   * can only be entered through the provider. Linked to any existing local
   * account by email.
   */
  async oauthSignIn(profile: { email: string; displayName?: string; avatarUrl?: string | null }): Promise<IssuedTokens> {
    const email = profile.email.trim().toLowerCase();
    if (!email) throw new UnauthorizedException('No email from provider');
    let user = await this.users.findByEmail(email);
    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      user = await this.users.create({
        email,
        passwordHash,
        displayName: profile.displayName?.trim() || email.split('@')[0],
        avatarUrl: profile.avatarUrl ?? null,
      });
    } else if (profile.avatarUrl && !user.avatarUrl) {
      await this.users.update(user.id, { avatarUrl: profile.avatarUrl });
      user.avatarUrl = profile.avatarUrl;
    }
    return this.issue(user.id, user.email, user.displayName, user.role, user.phone);
  }

  /** Create a short-lived, tamper-proof OAuth state shared by web callbacks. */
  createOAuthState(provider: OAuthProvider): string {
    const payload: OAuthState = {
      provider,
      nonce: randomBytes(24).toString('base64url'),
      exp: Date.now() + 10 * 60_000,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  /** Reject callbacks whose state was altered, expired, or issued for another provider. */
  verifyOAuthState(raw: string, provider: OAuthProvider): void {
    const [encoded, signature] = String(raw || '').split('.');
    if (!encoded || !signature) throw new UnauthorizedException('Invalid OAuth state');
    const expected = createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(encoded)
      .digest('base64url');
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      throw new UnauthorizedException('Invalid OAuth state');
    }
    let state: OAuthState;
    try {
      state = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthState;
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }
    if (state.provider !== provider || !state.nonce || state.exp < Date.now()) {
      throw new UnauthorizedException('Expired or mismatched OAuth state');
    }
  }

  /** Build the SPA landing URL. Tokens stay in the fragment and are not sent in HTTP requests. */
  oauthFrontendRedirect(provider: OAuthProvider, result: IssuedTokens | Error): string {
    const frontend = this.config.get<string>('APP_FRONTEND_URL') || 'http://localhost:5173/';
    const base = frontend.endsWith('/') ? frontend : `${frontend}/`;
    const redirect = new URL(`oauth/${provider}`, base);
    const fragment = result instanceof Error
      ? new URLSearchParams({ error: result.message || `${provider} sign-in failed` })
      : new URLSearchParams({ access_token: result.accessToken, refresh_token: result.refreshToken });
    redirect.hash = fragment.toString();
    return redirect.toString();
  }

  /** Verify a Google ID token (GIS credential) and sign the user in. */
  async googleSignIn(credential: string): Promise<IssuedTokens> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new BadRequestException('Google sign-in is not configured');
    if (!credential) throw new BadRequestException('Missing Google credential');
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
      .catch(() => null);
    if (!res || !res.ok) throw new UnauthorizedException('Could not verify Google token');
    const p = (await res.json()) as { aud?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string };
    if (p.aud !== clientId) throw new UnauthorizedException('Google token was issued for a different app');
    if (!p.email || !(p.email_verified === true || p.email_verified === 'true')) throw new UnauthorizedException('Google email not verified');
    return this.oauthSignIn({ email: p.email, displayName: p.name, avatarUrl: p.picture });
  }

  /** The URL to send the user to start TikTok Login (auth-code flow). */
  tiktokAuthUrl(state: string): string {
    const key = this.config.get<string>('TIKTOK_CLIENT_KEY');
    const redirect = this.config.get<string>('TIKTOK_REDIRECT_URI');
    if (!key || !redirect) throw new BadRequestException('TikTok sign-in is not configured');
    const params = new URLSearchParams({
      client_key: key, response_type: 'code', scope: 'user.info.basic',
      redirect_uri: redirect, state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  /** Exchange a TikTok auth code for tokens + profile, then sign in. */
  async tiktokSignIn(code: string): Promise<IssuedTokens> {
    const key = this.config.get<string>('TIKTOK_CLIENT_KEY');
    const secret = this.config.get<string>('TIKTOK_CLIENT_SECRET');
    const redirect = this.config.get<string>('TIKTOK_REDIRECT_URI');
    if (!key || !secret || !redirect) throw new BadRequestException('TikTok sign-in is not configured');
    if (!code) throw new BadRequestException('Missing TikTok code');
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: key, client_secret: secret, code, grant_type: 'authorization_code', redirect_uri: redirect }).toString(),
    }).catch(() => null);
    const tok = (tokenRes && tokenRes.ok ? await tokenRes.json() : null) as { access_token?: string; open_id?: string } | null;
    if (!tok?.access_token || !tok.open_id) throw new UnauthorizedException('TikTok token exchange failed');
    let name = 'TikTok user';
    let avatar: string | null = null;
    try {
      const infoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', { headers: { Authorization: `Bearer ${tok.access_token}` } });
      const info = (await infoRes.json()) as { data?: { user?: { display_name?: string; avatar_url?: string } } };
      name = info.data?.user?.display_name ?? name;
      avatar = info.data?.user?.avatar_url ?? null;
    } catch { /* profile fetch is best-effort */ }
    // TikTok may not return an email → synthesise a stable identity address.
    return this.oauthSignIn({ email: `tiktok_${tok.open_id}@users.kobeos.local`, displayName: name, avatarUrl: avatar });
  }

  /** The Facebook Login consent URL used for "Continue with Meta". */
  metaAuthUrl(state: string): string {
    const appId = this.config.get<string>('META_APP_ID') || this.config.get<string>('INSTAGRAM_APP_ID');
    const redirectUri = this.config.get<string>('META_REDIRECT_URI');
    const version = this.config.get<string>('META_GRAPH_VERSION') || 'v26.0';
    if (!appId || !redirectUri) throw new BadRequestException('Meta sign-in is not configured');
    const configId = this.config.get<string>('META_LOGIN_CONFIG_ID')?.trim();
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    // Facebook Login for Business uses a dashboard configuration instead of
    // arbitrary OAuth scopes. Keep the fallback compatible with the standard
    // Facebook Login product, while never requesting Meta's invalid `email`
    // scope for account creation.
    if (configId) params.set('config_id', configId);
    else params.set('scope', 'public_profile');
    return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
  }

  /** Exchange a Meta authorization code, load the profile, and create/sign in the Kobe account. */
  async metaSignIn(code: string): Promise<IssuedTokens> {
    const appId = this.config.get<string>('META_APP_ID') || this.config.get<string>('INSTAGRAM_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET') || this.config.get<string>('INSTAGRAM_APP_SECRET');
    const redirectUri = this.config.get<string>('META_REDIRECT_URI');
    const version = this.config.get<string>('META_GRAPH_VERSION') || 'v26.0';
    if (!appId || !appSecret || !redirectUri) throw new BadRequestException('Meta sign-in is not configured');
    if (!code) throw new BadRequestException('Missing Meta authorization code');

    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.search = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    }).toString();
    const tokenResponse = await fetch(tokenUrl).catch(() => null);
    const tokenBody = tokenResponse
      ? await tokenResponse.json().catch(() => ({})) as { access_token?: string; error?: { message?: string } }
      : null;
    if (!tokenResponse?.ok || !tokenBody?.access_token) {
      throw new UnauthorizedException(tokenBody?.error?.message || 'Meta token exchange failed');
    }

    const profileUrl = new URL(`https://graph.facebook.com/${version}/me`);
    profileUrl.search = new URLSearchParams({
      fields: 'id,name,picture.type(large)',
      access_token: tokenBody.access_token,
    }).toString();
    const profileResponse = await fetch(profileUrl).catch(() => null);
    const profile = profileResponse
      ? await profileResponse.json().catch(() => ({})) as {
          id?: string;
          name?: string;
          email?: string;
          picture?: { data?: { url?: string } };
          error?: { message?: string };
        }
      : null;
    if (!profileResponse?.ok || !profile?.id) {
      throw new UnauthorizedException(profile?.error?.message || 'Could not load the Meta profile');
    }
    const email = profile.email || `meta_${profile.id}@users.kobeos.local`;
    return this.oauthSignIn({
      email,
      displayName: profile.name || 'Meta user',
      avatarUrl: profile.picture?.data?.url || null,
    });
  }

  /**
   * Verify a manager's credentials without issuing JWTs. Used by the POS
   * "inline approve" flow when a discount exceeds the auto-approval
   * threshold and a manager needs to authorise the cashier's checkout
   * without switching the logged-in user on the till.
   *
   * Enforces role ∈ {admin, manager, owner} — a cashier cannot
   * self-approve their own over-threshold discount even if they know
   * their own credentials.
   *
   * Runs bcrypt.compare against a fixed dummy hash on the miss path
   * so the response time doesn't reveal whether the email exists.
   */
  async verifyManager(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; displayName: string; role: string }> {
    const user = await this.users.findByEmail(email);
    // Compare against a fixed hash when the email doesn't exist so the
    // timing profile matches the real-user path (~100ms bcrypt cost).
    // Prevents email enumeration via response-time analysis.
    const passwordHash = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const ok = await bcrypt.compare(password, passwordHash);
    if (!user || !ok) throw new UnauthorizedException('Invalid manager credentials');
    const APPROVER_ROLES = new Set(['admin', 'manager', 'owner']);
    if (!APPROVER_ROLES.has(user.role)) {
      throw new UnauthorizedException(
        'This account cannot authorise discounts — a manager or owner must sign in',
      );
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  /**
   * Precomputed bcrypt hash of a random 32-byte secret. Never matches
   * any real password. Used to normalise the timing of verifyManager
   * on cache-miss so email existence isn't leaked via response time.
   */
  private static readonly DUMMY_HASH =
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  /**
   * Exchange a refresh token for a new access + refresh pair. The presented
   * token is revoked atomically so a leaked refresh token is single-use.
   */
  async refresh(rawToken: string): Promise<IssuedTokens> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const tokenHash = sha256(rawToken);
    const record = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.revoked) throw new UnauthorizedException('Refresh token revoked');
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedException('User no longer exists');

    record.revoked = true;
    record.revokedAt = new Date();
    await this.refreshTokens.save(record);

    return this.issue(user.id, user.email, user.displayName, user.role, user.phone);
  }

  async logout(rawToken: string): Promise<{ ok: true }> {
    if (!rawToken) return { ok: true };
    const tokenHash = sha256(rawToken);
    await this.refreshTokens.update({ tokenHash }, { revoked: true, revokedAt: new Date() });
    return { ok: true };
  }

  async revokeAllForUser(userId: string) {
    await this.refreshTokens.update(
      { userId, revoked: false },
      { revoked: true, revokedAt: new Date() },
    );
  }

  private async issue(
    sub: string,
    email: string,
    displayName: string | undefined,
    role: User['role'],
    phone?: string | null,
  ): Promise<IssuedTokens> {
    const accessExpires = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshDays = Number(this.config.get<string>('REFRESH_EXPIRES_DAYS', '30'));

    const accessToken = await this.jwt.signAsync(
      { sub, email, role },
      { expiresIn: accessExpires },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId: sub,
        tokenHash: sha256(refreshToken),
        expiresAt,
        revoked: false,
      }),
    );

    return { accessToken, refreshToken, user: { id: sub, email, phone, displayName, role } };
  }

  /** Nightly job: remove expired and revoked refresh tokens older than 7 days. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneRefreshTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.refreshTokens.delete({
      expiresAt: LessThan(cutoff),
    });
    const revokedResult = await this.refreshTokens
      .createQueryBuilder()
      .delete()
      .where('revoked = true AND "revokedAt" < :cutoff', { cutoff })
      .execute();
    const total = (result.affected ?? 0) + (revokedResult.affected ?? 0);
    if (total > 0) {
      new Logger('AuthService').log(`Pruned ${total} stale refresh tokens`);
    }
  }
}
