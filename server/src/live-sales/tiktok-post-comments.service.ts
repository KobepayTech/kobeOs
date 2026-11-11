import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { SocialAccount } from '../social-scheduler/social-account.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';
import { socialPostKey } from './social-sale-comment';

const PLATFORM = 'tiktok-business-comments';
const API = 'https://business-api.tiktok.com/open_api/v1.3/';
type Comment = { comment_id: string; video_id: string; text: string; username?: string; unique_identifier?: string;
  owner?: boolean; status: string; create_time: string; parent_comment_id?: string };
type CommentPage = { comments: Comment[]; has_more: boolean; cursor: number };

@Injectable()
export class TikTokPostCommentsService {
  private readonly logger = new Logger(TikTokPostCommentsService.name);
  private polling = false;

  constructor(
    @InjectRepository(LiveSession) private readonly sessions: Repository<LiveSession>,
    @InjectRepository(SocialAccount) private readonly accounts: Repository<SocialAccount>,
    private readonly sales: LiveSaleService,
    private readonly audit: AuditService,
  ) {}

  private async request<T>(token: string, route: string, body?: object): Promise<T> {
    const response = await fetch(new URL(route, API), {
      method: body ? 'POST' : 'GET',
      headers: { 'Access-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    // TikTok describes IDs as strings but some responses represent them as numbers.
    const raw = await response.text();
    const result = JSON.parse(raw.replace(/("(?:video_id|comment_id|parent_comment_id)"\s*:\s*)(\d+)/g, '$1"$2"')) as { code?: number; data?: T };
    if (!response.ok || result.code !== 0) throw new Error(`TikTok Business API rejected the request (HTTP ${response.status}, code ${result.code ?? 'unknown'})`);
    return result.data as T;
  }

  private list(account: SocialAccount, videoId: string, cursor: number) {
    const query = new URLSearchParams({ business_id: String(account.metadata.businessId), video_id: videoId,
      status: 'PUBLIC', sort_field: 'create_time', sort_order: 'desc', max_count: '30', cursor: String(cursor) });
    return this.request<CommentPage>(account.accessToken, `business/comment/list/?${query}`).then((page) => {
      if (!Array.isArray(page?.comments)) throw new Error('TikTok returned an invalid comment page');
      return page;
    });
  }

  private connection(ownerId: string) {
    return this.accounts.findOne({ where: { ownerId, platform: PLATFORM }, order: { updatedAt: 'DESC' } });
  }

  async status(ownerId: string) {
    const account = await this.connection(ownerId);
    return { connected: account?.status === 'connected', businessId: account?.status === 'connected' ? String(account.metadata.businessId) : '' };
  }

  async configure(ownerId: string, businessId: string, accessToken: string, postUrl: string) {
    const videoId = socialPostKey('tiktok', postUrl);
    if (!videoId) throw new BadRequestException('Paste the full URL of a TikTok post you own.');
    const existing = await this.connection(ownerId);
    if (existing && existing.metadata.businessId !== businessId && existing.status === 'connected') {
      throw new BadRequestException('Disconnect the existing TikTok comment account before switching businesses.');
    }
    const account = this.accounts.create({
      ...(existing?.metadata.businessId === businessId ? { id: existing.id } : {}),
      ownerId, platform: PLATFORM, accountName: 'TikTok Business comments', accountHandle: '',
      accessToken, refreshToken: null, tokenExpiresAt: null, status: 'connected', accountAvatar: null,
      metadata: { businessId, connectedAt: new Date().toISOString() },
    });
    try { await this.list(account, videoId, 0); }
    catch { throw new BadRequestException('TikTok could not read comments on that post. Verify the Business access token, business ID, and post ownership.'); }
    await this.accounts.save(account);
    await this.audit.log({ action: 'UPDATE', entityType: 'tiktok_post_comments', entityId: account.id, userId: ownerId, metadata: { connected: true } });
    return this.status(ownerId);
  }

  async disconnect(ownerId: string) {
    const account = await this.connection(ownerId);
    if (!account || account.status !== 'connected') return { connected: false };
    account.accessToken = 'disconnected';
    account.status = 'disconnected';
    await this.accounts.save(account);
    await this.audit.log({ action: 'UPDATE', entityType: 'tiktok_post_comments', entityId: account.id, userId: ownerId, metadata: { connected: false } });
    return { connected: false };
  }

  async accountForCampaign(ownerId: string, postUrl: string) {
    const account = await this.connection(ownerId);
    if (account?.status !== 'connected') return undefined;
    const videoId = socialPostKey('tiktok', postUrl);
    if (!videoId) throw new BadRequestException('Paste the full URL of a TikTok post you own.');
    try { await this.list(account, videoId, 0); }
    catch { throw new BadRequestException('This TikTok post could not be verified on your connected Business account.'); }
    return account.id;
  }

  @Cron('15 */2 * * * *')
  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const campaigns = await this.sessions.find({ where: { kind: 'post', platform: 'tiktok', status: 'LIVE', socialAccountId: Not(IsNull()) } });
      for (const campaign of campaigns) {
        await this.pollCampaign(campaign).catch((error: Error) => this.logger.warn(`TikTok comment campaign ${campaign.id}: ${error.message}`));
      }
    } finally {
      this.polling = false;
    }
  }

  private async pollCampaign(campaign: LiveSession) {
    const account = await this.accounts.findOne({
      where: { id: campaign.socialAccountId!, ownerId: campaign.ownerId, platform: PLATFORM, status: 'connected' },
    });
    const videoId = socialPostKey('tiktok', campaign.postUrl);
    if (!account || !videoId) return;
    const since = Math.floor(Math.max(campaign.createdAt.getTime(), Date.parse(String(account.metadata.connectedAt)) || 0, Date.now() - 24 * 60 * 60 * 1000) / 1000);
    let cursor = 0;
    for (let page = 0; page < 5; page += 1) {
      const data = await this.list(account, videoId, cursor);
      for (const comment of data.comments) {
        if (comment.owner || comment.status !== 'PUBLIC' || String(comment.video_id) !== videoId ||
          !/^\d+$/.test(String(comment.comment_id)) || !comment.text?.trim() || !(Number(comment.create_time) >= since)) continue;
        const id = String(comment.comment_id);
        const result = await this.sales.ingestComment(campaign.ownerId, campaign.id, {
          source: 'post-tiktok', externalId: id, buyerHandle: (comment.username || comment.unique_identifier || '').slice(0, 80), text: comment.text.slice(0, 1000),
        });
        if (!result.publicReply) continue;
        await this.request(account.accessToken, 'business/comment/reply/create/', {
          business_id: account.metadata.businessId, video_id: videoId, comment_id: id, text: result.publicReply.slice(0, 1200),
        }).catch(() => this.logger.warn(`TikTok reply failed for comment ${id}`));
      }
      if (!data.has_more || data.cursor === cursor || data.comments.some((comment) => Number(comment.create_time) < since)) break;
      cursor = data.cursor;
    }
  }
}
