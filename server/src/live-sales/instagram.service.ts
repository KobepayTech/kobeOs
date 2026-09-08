import { relayTarget } from './relay-target';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { SocialAccount } from '../social-scheduler/social-account.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';
import { resolveFrontendUrl, resolvePublicApiUrl } from '../common/frontend-url';

type InstagramProfile = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

type InstagramToken = {
  access_token?: string;
  user_id?: string;
  expires_in?: number;
};

type InstagramState = { ownerId: string; nonce: string; exp: number };
const INSTAGRAM_WEBHOOK_PATH = '/api/live-sales/public/webhooks/instagram';

/** Free, official Instagram Business Login + Graph API integration. */
@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SocialAccount) private readonly accounts: Repository<SocialAccount>,
    @InjectRepository(LiveSession) private readonly sessions: Repository<LiveSession>,
    private readonly liveSales: LiveSaleService,
  ) {}

  private value(name: string): string {
    return this.config.get<string>(name)?.trim() || '';
  }

  private required(name: string): string {
    const value = this.value(name);
    if (!value) throw new BadRequestException(`Instagram is not configured: missing ${name}`);
    return value;
  }

  private apiVersion(): string {
    return this.value('INSTAGRAM_API_VERSION') || 'v24.0';
  }

  private graph(path: string): string {
    return `https://graph.instagram.com/${this.apiVersion()}/${path.replace(/^\//, '')}`;
  }

  private async json<T>(response: Response): Promise<T> {
    const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string }; error_message?: string };
    if (!response.ok) {
      throw new BadRequestException(body.error?.message || body.error_message || `Instagram API returned HTTP ${response.status}`);
    }
    return body;
  }

  /**
   * Every Instagram connection is a production Creator connection, not a
   * cosmetic login. Always request the scopes required by the working Kobe
   * workflows even if an older deployment's env list omitted them.
   */
  private oauthScopes(): string[] {
    const configured = this.value('INSTAGRAM_OAUTH_SCOPES')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
    return [...new Set([
      ...configured,
      'instagram_business_basic',
      'instagram_business_content_publish',
      'instagram_business_manage_comments',
      'instagram_business_manage_messages',
      'instagram_business_manage_insights',
    ])];
  }

  private signState(payload: InstagramState): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.required('JWT_SECRET')).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private readState(raw: string): InstagramState {
    const [encoded, signature] = String(raw || '').split('.');
    if (!encoded || !signature) throw new BadRequestException('Invalid Instagram OAuth state');
    const expected = createHmac('sha256', this.required('JWT_SECRET')).update(encoded).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Invalid Instagram OAuth state');
    const state = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as InstagramState;
    if (!state.ownerId || !state.nonce || !state.exp || state.exp < Date.now()) throw new BadRequestException('Expired Instagram OAuth state');
    return state;
  }

  frontendRedirectUrl(): string {
    return resolveFrontendUrl((key) => this.config.get<string>(key));
  }

  webhookUrl(): string {
    // Always absolute: this value is what the operator registers in the Meta App
    // dashboard, and Meta rejects a relative path.
    try {
      return new URL(INSTAGRAM_WEBHOOK_PATH, resolvePublicApiUrl((key) => this.config.get<string>(key))).toString();
    } catch {
      return INSTAGRAM_WEBHOOK_PATH;
    }
  }

  getOAuthUrl(ownerId: string) {
    const clientId = this.required('INSTAGRAM_APP_ID');
    const redirectUri = this.required('INSTAGRAM_REDIRECT_URI');
    const scope = this.oauthScopes().join(',');
    const state = this.signState({ ownerId, nonce: randomBytes(16).toString('hex'), exp: Date.now() + 10 * 60_000 });
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
    }).toString();
    return { url: url.toString() };
  }

  private async exchange(code: string): Promise<{ token: string; userId: string; expiresAt: Date | null }> {
    const clientId = this.required('INSTAGRAM_APP_ID');
    const clientSecret = this.required('INSTAGRAM_APP_SECRET');
    const redirectUri = this.required('INSTAGRAM_REDIRECT_URI');
    if (!code) throw new BadRequestException('Instagram did not return an authorization code');

    const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code }).toString(),
    });
    const short = await this.json<InstagramToken>(shortResponse);
    if (!short.access_token || !short.user_id) throw new BadRequestException('Instagram token exchange did not return an account');

    const longUrl = new URL('https://graph.instagram.com/access_token');
    longUrl.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: clientSecret, access_token: short.access_token }).toString();
    const longResponse = await fetch(longUrl);
    const long = await this.json<InstagramToken>(longResponse);
    const token = long.access_token || short.access_token;
    const expiresIn = Number(long.expires_in || short.expires_in || 0);
    return { token, userId: short.user_id, expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null };
  }

  private async profile(userId: string, token: string): Promise<InstagramProfile> {
    const url = new URL(this.graph(userId));
    url.search = new URLSearchParams({ fields: 'id,username,name,profile_picture_url', access_token: token }).toString();
    return this.json<InstagramProfile>(await fetch(url));
  }

  private async subscribeWebhooks(userId: string, token: string): Promise<boolean> {
    const url = new URL(this.graph(`${userId}/subscribed_apps`));
    url.search = new URLSearchParams({ subscribed_fields: 'comments,live_comments', access_token: token }).toString();
    const response = await fetch(url, { method: 'POST' });
    const body = await this.json<{ success?: boolean }>(response);
    return body.success === true;
  }

  async completeOAuth(code: string, rawState: string) {
    const state = this.readState(rawState);
    const exchanged = await this.exchange(code);
    const profile = await this.profile(exchanged.userId, exchanged.token);
    let webhookSubscribed = false;
    try {
      webhookSubscribed = await this.subscribeWebhooks(exchanged.userId, exchanged.token);
    } catch (e) {
      this.logger.warn(`Instagram webhook subscription failed: ${(e as Error).message}`);
    }

    const ownerAccounts = await this.accounts.find({ where: { ownerId: state.ownerId, platform: 'instagram' } });
    let account = ownerAccounts.find((item) => String(item.metadata?.instagramUserId || '') === exchanged.userId);
    if (!account) account = this.accounts.create({ ownerId: state.ownerId, platform: 'instagram' });
    account.accountName = profile.name || profile.username || 'Instagram account';
    account.accountHandle = profile.username ? `@${profile.username}` : exchanged.userId;
    account.accessToken = exchanged.token;
    account.refreshToken = null;
    account.tokenExpiresAt = exchanged.expiresAt;
    account.accountAvatar = profile.profile_picture_url || null;
    account.status = 'connected';
    account.metadata = {
      ...(account.metadata || {}),
      instagramUserId: profile.id || exchanged.userId,
      scopes: this.oauthScopes(),
      webhookSubscribed,
      webhookPath: INSTAGRAM_WEBHOOK_PATH,
      lastSyncedAt: new Date().toISOString(),
    };
    await this.accounts.save(account);
    return { webhookSubscribed, account: this.safe(account) };
  }

  private safe(account: SocialAccount) {
    return {
      connected: true as const,
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      accountHandle: account.accountHandle,
      accountAvatar: account.accountAvatar,
      status: account.status,
      tokenExpiresAt: account.tokenExpiresAt,
      webhookSubscribed: account.metadata?.webhookSubscribed === true,
      webhookUrl: this.webhookUrl(),
    };
  }

  async getConnection(ownerId: string) {
    const accounts = await this.accounts.find({ where: { ownerId, platform: 'instagram' }, order: { updatedAt: 'DESC' } });
    const account = accounts.find((item) => this.isUsable(item));
    return account ? this.safe(account) : { connected: false as const };
  }

  async resolveSessionAccount(ownerId: string, platform?: string, requestedId?: string) {
    if (!['instagram', 'tiktok'].includes(platform || '')) return undefined;
    const accounts = (await this.accounts.find({ where: { ownerId, platform, status: 'connected' }, order: { updatedAt: 'DESC' } })).filter((item) => this.isUsable(item));
    const account = requestedId ? accounts.find((item) => item.id === requestedId) : accounts[0];
    if (!account) throw new BadRequestException(`Connect your ${platform} account before enabling phone live sales.`);
    if (platform === 'instagram' && account.metadata?.webhookSubscribed !== true) {
      const userId = String(account.metadata?.instagramUserId || '');
      if (userId) {
        try {
          account.metadata = { ...account.metadata, webhookSubscribed: await this.subscribeWebhooks(userId, account.accessToken) };
          await this.accounts.save(account);
        } catch { this.logger.warn('Instagram Live comments subscription needs account setup.'); }
      }
    }
    return account.id;
  }

  async registerRelay(ownerId: string, accountId: string, target: string) {
    const url = relayTarget(target, this.value('TENANT_BASE_DOMAIN') || 'kobeapptz.com');
    const socialAccountId = await this.resolveSessionAccount(ownerId, 'instagram', accountId);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new BadRequestException('Your store computer is unreachable. Keep KobeOS online and retry.');
    const info = await response.json() as { status?: string; platform?: string };
    if (info.status !== 'LIVE' || info.platform !== 'instagram') throw new BadRequestException('Open an Instagram Live Sales session on your store computer first.');
    const session = await this.liveSales.startSession(ownerId, { platform: 'instagram', socialAccountId, title: 'Phone live sales' });
    session.relayTargetUrl = url;
    session.relayExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.sessions.save(session);
    return { id: session.id, expiresAt: session.relayExpiresAt, ...(await this.sessionConnection(ownerId, session.id)) };
  }

  private isUsable(account: SocialAccount): boolean {
    return account.status === 'connected' && (!account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() > Date.now());
  }

  async connections(ownerId: string) {
    const accounts = await this.accounts.find({ where: { ownerId }, order: { updatedAt: 'DESC' } });
    return accounts.map((account) => ({
      id: account.id, platform: account.platform, accountHandle: account.accountHandle,
      connected: this.isUsable(account), webhookSubscribed: account.metadata?.webhookSubscribed === true,
    }));
  }

  async sessionConnection(ownerId: string, sessionId: string) {
    const session = await this.liveSales.getSession(ownerId, sessionId);
    const account = session.socialAccountId ? await this.accounts.findOne({ where: { id: session.socialAccountId, ownerId, platform: session.platform } }) : null;
    return {
      accountHandle: account?.accountHandle || '',
      connected: !!account && this.isUsable(account),
      webhookSubscribed: account?.metadata?.webhookSubscribed === true,
      lastCommentAt: account?.metadata?.lastLiveCommentAt || null,
    };
  }

  async disconnect(ownerId: string) {
    const accounts = await this.accounts.find({ where: { ownerId, platform: 'instagram' } });
    if (accounts.length) await this.accounts.remove(accounts);
    return { disconnected: true };
  }

  async retryWebhookSubscription(ownerId: string) {
    const account = await this.accounts.findOne({
      where: { ownerId, platform: 'instagram', status: 'connected' },
      order: { updatedAt: 'DESC' },
    });
    if (!account || !this.isUsable(account)) throw new BadRequestException('Reconnect your Instagram Professional account first');
    const userId = String(account.metadata?.instagramUserId || '');
    if (!userId) throw new BadRequestException('Instagram account metadata is incomplete; reconnect the account');
    const webhookSubscribed = await this.subscribeWebhooks(userId, account.accessToken);
    account.metadata = { ...(account.metadata || {}), webhookSubscribed, lastSyncedAt: new Date().toISOString() };
    await this.accounts.save(account);
    return this.safe(account);
  }

  verifyWebhook(mode: string, token: string): boolean {
    return mode === 'subscribe' && !!token && token === this.value('IG_WEBHOOK_VERIFY_TOKEN');
  }

  verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    const appSecret = this.value('INSTAGRAM_APP_SECRET');
    if (!rawBody || !signature || !appSecret || !signature.startsWith('sha256=')) return false;
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private readSignedRequest(raw: string): { user_id?: string } {
    const [encodedSignature, encodedPayload] = String(raw || '').split('.');
    if (!encodedSignature || !encodedPayload) throw new BadRequestException('Invalid Instagram signed request');
    const expected = createHmac('sha256', this.required('INSTAGRAM_APP_SECRET')).update(encodedPayload).digest('base64url');
    const a = Buffer.from(encodedSignature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('Invalid Instagram signed request');
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as { user_id?: string };
  }

  private async removeAccountByInstagramUserId(userId?: string) {
    if (!userId) return;
    const accounts = (await this.accounts.find({ where: { platform: 'instagram' } })).filter(
      (account) => String(account.metadata?.instagramUserId || '') === userId,
    );
    if (accounts.length) await this.accounts.remove(accounts);
  }

  async handleDeauthorize(signedRequest: string) {
    const payload = this.readSignedRequest(signedRequest);
    await this.removeAccountByInstagramUserId(payload.user_id);
    return { success: true };
  }

  async handleDataDeletion(signedRequest: string) {
    const payload = this.readSignedRequest(signedRequest);
    await this.removeAccountByInstagramUserId(payload.user_id);
    return {
      url: this.frontendRedirectUrl(),
      confirmation_code: randomBytes(12).toString('hex'),
    };
  }

  private async replyToComment(account: SocialAccount, commentId: string, message: string) {
    if (!commentId || !message) return;
    const userId = String(account.metadata?.instagramUserId || '');
    const response = await fetch(this.graph(`${userId}/messages`), {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: message } }),
    });
    await this.json(response);
  }

  async handleWebhook(body: unknown, rawBody?: Buffer, signature?: string): Promise<{ ok: true; ingested: number }> {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid Instagram webhook signature');
    }
    let ingested = 0;
    const entries = (body as { entry?: unknown[] })?.entry ?? [];
    const accounts = await this.accounts.find({ where: { platform: 'instagram', status: 'connected' } });
    for (const rawEntry of entries) {
      const entry = rawEntry as { id?: string; changes?: unknown[] };
      const account = accounts.find((item) => String(item.metadata?.instagramUserId || '') === String(entry.id || ''));
      if (!account) continue;
      const sessions = await this.sessions.find({
        where: { ownerId: account.ownerId, socialAccountId: account.id, status: 'LIVE' },
        order: { createdAt: 'DESC' },
      });
      for (const rawChange of entry.changes || []) {
        const change = rawChange as { field?: string; value?: { id?: string; text?: string; message?: string; from?: { username?: string; id?: string } } };
        if (change.field !== 'comments' && change.field !== 'live_comments') continue;
        const session = change.field === 'live_comments'
          ? sessions.find((item) => item.kind === 'live')
          : sessions.find((item) => item.kind === 'post');
        if (!session) continue;
        const value = change.value || {};
        const text = String(value.text || value.message || '').trim();
        if (!text) continue;
        const input = { source: 'instagram', buyerHandle: value.from?.username || value.from?.id || '', text, externalId: value.id || '' };
        let result: { reply?: string };
        if (session.relayTargetUrl) {
          if (!session.relayExpiresAt || session.relayExpiresAt.getTime() <= Date.now()) continue;
          const response = await fetch(relayTarget(session.relayTargetUrl, this.value('TENANT_BASE_DOMAIN') || 'kobeapptz.com'), {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
          });
          if (!response.ok) throw new BadRequestException('Store computer did not accept the live comment; delivery can be retried.');
          result = await response.json() as { reply?: string };
        } else {
          result = await this.liveSales.ingestComment(account.ownerId, session.id, input) as { reply?: string };
        }
        if (value.id && (result as { reply?: string })?.reply) {
          await this.replyToComment(account, value.id, (result as unknown as { reply: string }).reply).catch((e) => this.logger.warn(`Instagram reply failed: ${(e as Error).message}`));
        }
        if (change.field === 'live_comments') {
          account.metadata = { ...account.metadata, lastLiveCommentAt: new Date().toISOString() };
          await this.accounts.save(account);
        }
        ingested += 1;
      }
    }
    return { ok: true, ingested };
  }
}
