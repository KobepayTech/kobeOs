import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { MediaAssetsService } from '../media/media.service';
import { SocialAccount } from './social-account.entity';
import { SocialPost } from './social-post.entity';

type TikTokState = { ownerId: string; nonce: string; exp: number };

type TikTokTokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type TikTokProfile = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  username?: string;
  profile_deep_link?: string;
  bio_description?: string;
  is_verified?: boolean;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
};

type TikTokCreatorInfo = {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

type TikTokEnvelope<T> = {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
};

type TikTokPublishData = { publish_id?: string; upload_url?: string };

@Injectable()
export class TikTokService {
  private readonly logger = new Logger(TikTokService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SocialAccount) private readonly accounts: Repository<SocialAccount>,
    private readonly media: MediaAssetsService,
  ) {}

  private value(name: string): string {
    return this.config.get<string>(name)?.trim() || '';
  }

  private required(name: string): string {
    const value = this.value(name);
    if (!value) throw new BadRequestException(`TikTok is not configured: missing ${name}`);
    return value;
  }

  private redirectUri(): string {
    const explicit = this.value('TIKTOK_CREATOR_REDIRECT_URI');
    if (explicit) return explicit;
    const publicUrl = this.value('APP_PUBLIC_URL');
    if (!publicUrl) throw new BadRequestException('TikTok is not configured: missing TIKTOK_CREATOR_REDIRECT_URI');
    return `${publicUrl.replace(/\/+$/, '')}/api/social-scheduler/tiktok/oauth/callback`;
  }

  private scopes(): string[] {
    const configured = this.value('TIKTOK_CREATOR_OAUTH_SCOPES')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
    return [...new Set(configured.length ? configured : [
      'user.info.basic',
      'user.info.profile',
      'user.info.stats',
      'video.list',
      'video.publish',
    ])];
  }

  frontendRedirectUrl(): string {
    return this.value('APP_FRONTEND_URL') || this.value('FRONTEND_URL') || 'http://localhost:5173/';
  }

  private signState(payload: TikTokState): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.required('JWT_SECRET')).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private readState(raw: string): TikTokState {
    const [encoded, signature] = String(raw || '').split('.');
    if (!encoded || !signature) throw new BadRequestException('Invalid TikTok OAuth state');
    const expected = createHmac('sha256', this.required('JWT_SECRET')).update(encoded).digest('base64url');
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      throw new BadRequestException('Invalid TikTok OAuth state');
    }
    let state: TikTokState;
    try {
      state = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TikTokState;
    } catch {
      throw new BadRequestException('Invalid TikTok OAuth state');
    }
    if (!state.ownerId || !state.nonce || !state.exp || state.exp < Date.now()) {
      throw new BadRequestException('Expired TikTok OAuth state');
    }
    return state;
  }

  getOAuthUrl(ownerId: string) {
    const clientKey = this.required('TIKTOK_CLIENT_KEY');
    const state = this.signState({ ownerId, nonce: randomBytes(16).toString('hex'), exp: Date.now() + 10 * 60_000 });
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.search = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: this.scopes().join(','),
      redirect_uri: this.redirectUri(),
      state,
    }).toString();
    return { url: url.toString() };
  }

  private async tokenRequest(values: Record<string, string>): Promise<TikTokTokenResponse> {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
      body: new URLSearchParams(values).toString(),
    });
    const body = await response.json().catch(() => ({})) as TikTokTokenResponse;
    if (!response.ok || body.error || !body.access_token) {
      throw new BadRequestException(body.error_description || body.error || `TikTok token API returned HTTP ${response.status}`);
    }
    return body;
  }

  private async exchange(code: string): Promise<TikTokTokenResponse> {
    if (!code) throw new BadRequestException('TikTok did not return an authorization code');
    return this.tokenRequest({
      client_key: this.required('TIKTOK_CLIENT_KEY'),
      client_secret: this.required('TIKTOK_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri(),
    });
  }

  private grantedScopes(raw?: string): string[] {
    return String(raw || '').split(/[ ,]+/).map((scope) => scope.trim()).filter(Boolean);
  }

  private async api<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({})) as TikTokEnvelope<T>;
    const code = body.error?.code;
    if (!response.ok || (code && code !== 'ok')) {
      throw new BadRequestException(body.error?.message || code || `TikTok API returned HTTP ${response.status}`);
    }
    if (!body.data) throw new BadRequestException('TikTok API returned no data');
    return body.data;
  }

  private async profile(token: string, scopes: string[]): Promise<TikTokProfile> {
    const fields = ['open_id', 'union_id', 'avatar_url', 'display_name'];
    if (scopes.includes('user.info.profile')) {
      fields.push('username', 'profile_deep_link', 'bio_description', 'is_verified');
    }
    if (scopes.includes('user.info.stats')) {
      fields.push('follower_count', 'following_count', 'likes_count', 'video_count');
    }
    const url = new URL('https://open.tiktokapis.com/v2/user/info/');
    url.searchParams.set('fields', fields.join(','));
    const data = await this.api<{ user?: TikTokProfile }>(await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    }));
    return data.user || {};
  }

  private async creatorInfoWithToken(token: string): Promise<TikTokCreatorInfo> {
    return this.api<TikTokCreatorInfo>(await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    }));
  }

  private safe(account: SocialAccount) {
    const scopes = Array.isArray(account.metadata?.scopes)
      ? (account.metadata.scopes as unknown[]).map(String)
      : this.grantedScopes(String(account.metadata?.scope || ''));
    return {
      connected: true as const,
      id: account.id,
      platform: 'tiktok' as const,
      accountName: account.accountName,
      accountHandle: account.accountHandle,
      accountAvatar: account.accountAvatar,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt,
      scopes,
      lastSyncedAt: account.metadata?.lastSyncedAt ?? account.updatedAt,
      tiktokPrivacyLevel: String(account.metadata?.tiktokPrivacyLevel || ''),
      tiktokPrivacyOptions: Array.isArray(account.metadata?.tiktokPrivacyOptions)
        ? (account.metadata.tiktokPrivacyOptions as unknown[]).map(String)
        : [],
      stats: account.metadata?.stats ?? null,
    };
  }

  async completeOAuth(code: string, rawState: string) {
    const state = this.readState(rawState);
    const token = await this.exchange(code);
    const scopes = this.grantedScopes(token.scope);
    if (!token.open_id) throw new BadRequestException('TikTok token exchange did not return open_id');
    const profile = await this.profile(token.access_token!, scopes);

    let creatorInfo: TikTokCreatorInfo | null = null;
    if (scopes.includes('video.publish')) {
      try {
        creatorInfo = await this.creatorInfoWithToken(token.access_token!);
      } catch (error) {
        this.logger.warn(`TikTok creator-info query failed during connection: ${(error as Error).message}`);
      }
    }

    const rows = await this.accounts.find({ where: { ownerId: state.ownerId, platform: 'tiktok' } });
    let account = rows.find((row) => String(row.metadata?.openId || '') === token.open_id);
    if (!account) account = this.accounts.create({ ownerId: state.ownerId, platform: 'tiktok' });

    const privacyOptions = creatorInfo?.privacy_level_options || [];
    const currentPrivacy = String(account.metadata?.tiktokPrivacyLevel || '');
    const privacyLevel = privacyOptions.includes(currentPrivacy)
      ? currentPrivacy
      : privacyOptions.includes('SELF_ONLY')
        ? 'SELF_ONLY'
        : (privacyOptions[0] || '');

    account.accountName = profile.display_name || creatorInfo?.creator_nickname || 'TikTok account';
    account.accountHandle = profile.username
      ? `@${profile.username}`
      : creatorInfo?.creator_username
        ? `@${creatorInfo.creator_username}`
        : token.open_id;
    account.accountAvatar = profile.avatar_url || creatorInfo?.creator_avatar_url || null;
    account.accessToken = token.access_token!;
    account.refreshToken = token.refresh_token || null;
    account.tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    account.status = 'connected';
    account.metadata = {
      ...(account.metadata || {}),
      openId: token.open_id,
      unionId: profile.union_id || null,
      scopes,
      refreshExpiresAt: token.refresh_expires_in ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString() : null,
      profileDeepLink: profile.profile_deep_link || null,
      verified: profile.is_verified === true,
      stats: {
        followerCount: profile.follower_count ?? null,
        followingCount: profile.following_count ?? null,
        likesCount: profile.likes_count ?? null,
        videoCount: profile.video_count ?? null,
      },
      tiktokPrivacyLevel: privacyLevel,
      tiktokPrivacyOptions: privacyOptions,
      maxVideoPostDurationSec: creatorInfo?.max_video_post_duration_sec ?? null,
      lastSyncedAt: new Date().toISOString(),
    };
    await this.accounts.save(account);
    return this.safe(account);
  }

  async getConnection(ownerId: string) {
    const account = await this.accounts.findOne({
      where: { ownerId, platform: 'tiktok', status: 'connected' },
      order: { updatedAt: 'DESC' },
    });
    return account ? this.safe(account) : { connected: false as const };
  }

  /**
   * Publish content to the owner's connected TikTok via the Content Posting API.
   * Convenience wrapper so other modules (e.g. creator campaigns) can post
   * without constructing SocialPost/SocialAccount themselves. Returns the
   * TikTok publish id.
   */
  async publishForOwner(ownerId: string, input: { mediaUrls: string[]; caption?: string }): Promise<string> {
    const account = await this.getAccount(ownerId);
    const post = { ownerId, content: input.caption ?? '', mediaUrls: input.mediaUrls } as unknown as SocialPost;
    return this.publish(post, account);
  }

  private async getAccount(ownerId: string): Promise<SocialAccount> {
    const account = await this.accounts.findOne({
      where: { ownerId, platform: 'tiktok', status: 'connected' },
      order: { updatedAt: 'DESC' },
    });
    if (!account) throw new NotFoundException('Connect TikTok first');
    return account;
  }

  private async refreshAccount(account: SocialAccount): Promise<SocialAccount> {
    if (!account.refreshToken) throw new BadRequestException('TikTok refresh token is missing; reconnect TikTok');
    const token = await this.tokenRequest({
      client_key: this.required('TIKTOK_CLIENT_KEY'),
      client_secret: this.required('TIKTOK_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    });
    account.accessToken = token.access_token!;
    account.refreshToken = token.refresh_token || account.refreshToken;
    account.tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : account.tokenExpiresAt;
    const scopes = this.grantedScopes(token.scope);
    account.metadata = {
      ...(account.metadata || {}),
      ...(scopes.length ? { scopes } : {}),
      ...(token.refresh_expires_in ? { refreshExpiresAt: new Date(Date.now() + token.refresh_expires_in * 1000).toISOString() } : {}),
      lastTokenRefreshAt: new Date().toISOString(),
    };
    return this.accounts.save(account);
  }

  private async ensureFresh(account: SocialAccount): Promise<SocialAccount> {
    if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) return account;
    return this.refreshAccount(account);
  }

  async refresh(ownerId: string) {
    let account = await this.getAccount(ownerId);
    account = await this.refreshAccount(account);
    const scopes = Array.isArray(account.metadata?.scopes) ? (account.metadata.scopes as unknown[]).map(String) : [];
    const profile = await this.profile(account.accessToken, scopes);
    let creatorInfo: TikTokCreatorInfo | null = null;
    if (scopes.includes('video.publish')) creatorInfo = await this.creatorInfoWithToken(account.accessToken).catch(() => null);
    account.accountName = profile.display_name || account.accountName;
    account.accountHandle = profile.username ? `@${profile.username}` : account.accountHandle;
    account.accountAvatar = profile.avatar_url || account.accountAvatar;
    account.metadata = {
      ...(account.metadata || {}),
      stats: {
        followerCount: profile.follower_count ?? null,
        followingCount: profile.following_count ?? null,
        likesCount: profile.likes_count ?? null,
        videoCount: profile.video_count ?? null,
      },
      ...(creatorInfo?.privacy_level_options ? { tiktokPrivacyOptions: creatorInfo.privacy_level_options } : {}),
      ...(creatorInfo?.max_video_post_duration_sec ? { maxVideoPostDurationSec: creatorInfo.max_video_post_duration_sec } : {}),
      lastSyncedAt: new Date().toISOString(),
    };
    await this.accounts.save(account);
    return this.safe(account);
  }

  async setPreferences(ownerId: string, privacyLevel: string) {
    let account = await this.getAccount(ownerId);
    account = await this.ensureFresh(account);
    const creatorInfo = await this.creatorInfoWithToken(account.accessToken);
    const options = creatorInfo.privacy_level_options || [];
    if (!privacyLevel || !options.includes(privacyLevel)) {
      throw new BadRequestException(`TikTok privacy must be one of: ${options.join(', ') || 'no options returned'}`);
    }
    account.metadata = {
      ...(account.metadata || {}),
      tiktokPrivacyLevel: privacyLevel,
      tiktokPrivacyOptions: options,
      maxVideoPostDurationSec: creatorInfo.max_video_post_duration_sec ?? null,
      lastSyncedAt: new Date().toISOString(),
    };
    await this.accounts.save(account);
    return this.safe(account);
  }

  async disconnect(ownerId: string) {
    const rows = await this.accounts.find({ where: { ownerId, platform: 'tiktok' } });
    if (rows.length) await this.accounts.remove(rows);
    return { disconnected: true };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshExpiringTokens() {
    const cutoff = new Date(Date.now() + 2 * 60 * 60_000);
    const rows = await this.accounts.find({
      where: { platform: 'tiktok', status: 'connected', tokenExpiresAt: LessThan(cutoff) },
    });
    let refreshed = 0;
    for (const account of rows) {
      try {
        await this.refreshAccount(account);
        refreshed += 1;
      } catch (error) {
        this.logger.warn(`TikTok token refresh failed for ${account.id}: ${(error as Error).message}`);
      }
    }
    return { refreshed };
  }

  private async resolveMedia(ownerId: string, raw: string): Promise<{ url: string; kind: 'image' | 'video' }> {
    const value = String(raw || '').trim();
    const match = value.match(/(?:\/api)?\/media\/blob\/([0-9a-f-]{20,})$/i);
    if (match) {
      const asset = await this.media.get(ownerId, match[1]);
      const kind: 'image' | 'video' = asset.kind === 'video' || String(asset.mimeType || '').startsWith('video/') ? 'video' : 'image';
      return { url: await this.media.createPublicUrl(ownerId, asset.id, 2 * 60 * 60), kind };
    }
    if (!/^https:\/\//i.test(value)) {
      throw new BadRequestException('TikTok media must be an uploaded Kobe media asset or a public HTTPS URL');
    }
    const kind: 'image' | 'video' = /\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(value) ? 'video' : 'image';
    return { url: value, kind };
  }

  private async publishRequest(path: string, token: string, body: Record<string, unknown>): Promise<TikTokPublishData> {
    return this.api<TikTokPublishData>(await fetch(`https://open.tiktokapis.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
    }));
  }

  async publish(post: SocialPost, rawAccount: SocialAccount): Promise<string> {
    const account = await this.ensureFresh(rawAccount);
    const scopes = Array.isArray(account.metadata?.scopes) ? (account.metadata.scopes as unknown[]).map(String) : [];
    if (!scopes.includes('video.publish')) {
      throw new BadRequestException('TikTok Direct Post is not authorized; reconnect TikTok with video.publish');
    }
    if (!post.mediaUrls.length) throw new BadRequestException('TikTok Direct Post requires video or photo media');

    const creatorInfo = await this.creatorInfoWithToken(account.accessToken);
    const privacyOptions = creatorInfo.privacy_level_options || [];
    const configuredPrivacy = String(account.metadata?.tiktokPrivacyLevel || '');
    const privacyLevel = privacyOptions.includes(configuredPrivacy)
      ? configuredPrivacy
      : privacyOptions.includes('SELF_ONLY')
        ? 'SELF_ONLY'
        : privacyOptions[0];
    if (!privacyLevel) throw new BadRequestException('TikTok returned no allowed privacy level for this creator');

    const media = await Promise.all(post.mediaUrls.map((item) => this.resolveMedia(post.ownerId, item)));
    const videos = media.filter((item) => item.kind === 'video');
    const photos = media.filter((item) => item.kind === 'image');
    let result: TikTokPublishData;

    if (videos.length) {
      if (videos.length !== 1 || photos.length) throw new BadRequestException('TikTok video posts support one video and cannot mix video with photos');
      result = await this.publishRequest('/v2/post/publish/video/init/', account.accessToken, {
        post_info: {
          title: post.content.slice(0, 2200),
          privacy_level: privacyLevel,
          disable_duet: creatorInfo.duet_disabled === true,
          disable_stitch: creatorInfo.stitch_disabled === true,
          disable_comment: creatorInfo.comment_disabled === true,
          brand_content_toggle: false,
          brand_organic_toggle: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videos[0].url,
        },
      });
    } else {
      if (!photos.length) throw new BadRequestException('TikTok photo post has no images');
      if (photos.length > 35) throw new BadRequestException('TikTok allows at most 35 photos in one photo post');
      result = await this.publishRequest('/v2/post/publish/content/init/', account.accessToken, {
        media_type: 'PHOTO',
        post_mode: 'DIRECT_POST',
        post_info: {
          title: post.content.split(/\r?\n/)[0].slice(0, 90),
          description: post.content.slice(0, 4000),
          privacy_level: privacyLevel,
          disable_comment: creatorInfo.comment_disabled === true,
          auto_add_music: true,
          brand_content_toggle: false,
          brand_organic_toggle: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_images: photos.map((item) => item.url),
          photo_cover_index: 0,
        },
      });
    }

    if (!result.publish_id) throw new BadRequestException('TikTok did not return a publish id');
    account.metadata = {
      ...(account.metadata || {}),
      tiktokPrivacyLevel: privacyLevel,
      tiktokPrivacyOptions: privacyOptions,
      lastPublishId: result.publish_id,
      lastSyncedAt: new Date().toISOString(),
    };
    await this.accounts.save(account);
    return result.publish_id;
  }
}
