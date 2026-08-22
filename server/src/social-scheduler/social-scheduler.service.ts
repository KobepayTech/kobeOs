import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { MediaAssetsService } from '../media/media.service';
import { SocialPost } from './social-post.entity';
import { SocialAccount } from './social-account.entity';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
  PostFiltersDto,
  CreateSocialAccountDto,
  AnalyticsFiltersDto,
  SUPPORTED_PLATFORMS,
} from './dto/social-post.dto';

type PublishResult = { platform: string; ok: boolean; remoteId?: string; error?: string };
type InstagramContainer = { id?: string; status_code?: string; error?: { message?: string }; error_message?: string };

@Injectable()
export class SocialSchedulerService {
  private readonly logger = new Logger(SocialSchedulerService.name);

  constructor(
    @InjectRepository(SocialPost)
    private readonly postRepo: Repository<SocialPost>,
    @InjectRepository(SocialAccount)
    private readonly accountRepo: Repository<SocialAccount>,
    private readonly media: MediaAssetsService,
  ) {}

  private normalizePlatform(value: string): string {
    return String(value || '').trim().toLowerCase().replace(/^twitter\s*\/\s*x$/, 'twitter');
  }

  private validatePlatforms(platforms: string[]): string[] {
    const normalized = [...new Set((platforms || []).map((p) => this.normalizePlatform(p)).filter(Boolean))];
    const invalid = normalized.filter((p) => !(SUPPORTED_PLATFORMS as readonly string[]).includes(p));
    if (invalid.length) throw new BadRequestException(`Unsupported social platform: ${invalid.join(', ')}`);
    return normalized;
  }

  /* ─────────────── Posts ─────────────── */

  async createPost(ownerId: string, dto: CreateSocialPostDto) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) throw new BadRequestException('Invalid scheduledAt');
    const platforms = this.validatePlatforms(dto.platforms ?? []);
    if (!platforms.length) throw new BadRequestException('Select at least one connected platform');
    const requestedStatus = dto.status ?? (scheduledAt ? 'scheduled' : 'draft');
    if (requestedStatus === 'scheduled' && !scheduledAt) throw new BadRequestException('A scheduled post requires scheduledAt');
    return this.postRepo.save(
      this.postRepo.create({
        ownerId,
        content: dto.content,
        platforms,
        mediaUrls: dto.mediaUrls ?? [],
        scheduledAt,
        status: requestedStatus as SocialPost['status'],
        publishedAt: null,
        engagementStats: { likes: 0, comments: 0, shares: 0, impressions: 0 },
        platformPostIds: {},
      }),
    );
  }

  async getPosts(ownerId: string, filters: PostFiltersDto) {
    const page = Math.max(1, parseInt(filters.page ?? '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit ?? '50', 10)));
    const qb = this.postRepo.createQueryBuilder('post').where('post.ownerId = :ownerId', { ownerId });
    if (filters.status) qb.andWhere('post.status = :status', { status: filters.status });
    if (filters.platform) {
      qb.andWhere(':platform = ANY(string_to_array(post.platforms, \',\'))', { platform: this.normalizePlatform(filters.platform) });
    }
    if (filters.from) qb.andWhere('post.scheduledAt >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('post.scheduledAt <= :to', { to: new Date(filters.to) });
    qb.orderBy('post.scheduledAt', 'ASC', 'NULLS LAST').addOrderBy('post.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getPostById(id: string, ownerId: string) {
    const post = await this.postRepo.findOne({ where: { id, ownerId } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async updatePost(id: string, ownerId: string, dto: UpdateSocialPostDto) {
    const post = await this.getPostById(id, ownerId);
    if (post.status === 'publishing') throw new BadRequestException('A post cannot be edited while it is publishing');
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.platforms !== undefined) post.platforms = this.validatePlatforms(dto.platforms);
    if (dto.mediaUrls !== undefined) post.mediaUrls = dto.mediaUrls;
    if (dto.scheduledAt !== undefined) post.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.status !== undefined) post.status = dto.status as SocialPost['status'];
    if (post.status === 'scheduled' && !post.scheduledAt) throw new BadRequestException('A scheduled post requires scheduledAt');
    return this.postRepo.save(post);
  }

  async deletePost(id: string, ownerId: string) {
    const post = await this.getPostById(id, ownerId);
    if (post.status === 'publishing') throw new BadRequestException('Wait until publishing finishes before deleting this post');
    await this.postRepo.remove(post);
    return { id };
  }

  /* ─────────────── Provider capabilities ─────────────── */

  private safeAccount(account: SocialAccount) {
    const scopes = Array.isArray(account.metadata?.scopes)
      ? (account.metadata.scopes as unknown[]).map(String)
      : String(account.metadata?.scope || '').split(/[ ,]+/).filter(Boolean);
    return {
      id: account.id,
      platform: this.normalizePlatform(account.platform),
      accountName: account.accountName,
      accountHandle: account.accountHandle,
      tokenExpiresAt: account.tokenExpiresAt,
      status: account.status,
      accountAvatar: account.accountAvatar,
      scopes,
      lastSyncedAt: account.metadata?.lastSyncedAt ?? account.updatedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  async getCapabilities(ownerId: string) {
    const accounts = await this.accountRepo.find({ where: { ownerId }, order: { updatedAt: 'DESC' } });
    const byPlatform = new Map<string, ReturnType<SocialSchedulerService['safeAccount']>>();
    for (const raw of accounts) {
      const safe = this.safeAccount(raw);
      if (!byPlatform.has(safe.platform)) byPlatform.set(safe.platform, safe);
    }
    return SUPPORTED_PLATFORMS.map((platform) => {
      const account = byPlatform.get(platform);
      const scopes = new Set(account?.scopes ?? []);
      const connected = account?.status === 'connected';
      let publish = false;
      let reason = 'Provider publisher is not enabled in KobeOS yet.';
      if (platform === 'instagram') {
        publish = !!connected && scopes.has('instagram_business_content_publish');
        reason = !connected
          ? 'Connect an Instagram Professional account.'
          : publish
            ? ''
            : 'Reconnect Instagram after enabling instagram_business_content_publish in the Meta app.';
      } else if (platform === 'tiktok') {
        reason = !connected
          ? 'Connect TikTok after the Kobe app is approved for Content Posting API.'
          : scopes.has('video.publish')
            ? 'TikTok publishing adapter is not enabled until Direct Post approval is active.'
            : 'TikTok must grant and the user must authorize video.publish.';
      }
      return {
        platform,
        connected,
        account: account ?? null,
        capabilities: {
          profileRead: connected,
          mediaRead: connected && (platform === 'instagram' || platform === 'tiktok'),
          metricsRead: connected && (platform === 'instagram' || platform === 'tiktok'),
          publishImage: publish,
          publishVideo: publish,
        },
        reason,
      };
    });
  }

  /* ─────────────── Instagram publishing ─────────────── */

  private instagramGraph(path: string): string {
    const version = (process.env.INSTAGRAM_API_VERSION || 'v24.0').trim();
    return `https://graph.instagram.com/${version}/${path.replace(/^\//, '')}`;
  }

  private async instagramJson<T>(response: Response): Promise<T> {
    const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string }; error_message?: string };
    if (!response.ok) {
      throw new BadRequestException(body.error?.message || body.error_message || `Instagram API returned HTTP ${response.status}`);
    }
    return body;
  }

  private async instagramPost<T>(path: string, values: Record<string, string>): Promise<T> {
    const response = await fetch(this.instagramGraph(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values).toString(),
    });
    return this.instagramJson<T>(response);
  }

  private async waitForInstagramContainer(id: string, token: string) {
    for (let i = 0; i < 30; i++) {
      const url = new URL(this.instagramGraph(id));
      url.search = new URLSearchParams({ fields: 'status_code', access_token: token }).toString();
      const row = await this.instagramJson<InstagramContainer>(await fetch(url));
      if (!row.status_code || row.status_code === 'FINISHED' || row.status_code === 'PUBLISHED') return;
      if (row.status_code === 'ERROR' || row.status_code === 'EXPIRED') {
        throw new BadRequestException(`Instagram media processing failed (${row.status_code})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new BadRequestException('Instagram media processing timed out');
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
      throw new BadRequestException('Social publishing media must be an uploaded Kobe media asset or a public HTTPS URL');
    }
    const kind: 'image' | 'video' = /\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(value) ? 'video' : 'image';
    return { url: value, kind };
  }

  private async createInstagramContainer(
    userId: string,
    token: string,
    media: { url: string; kind: 'image' | 'video' },
    caption: string,
    carouselItem = false,
  ): Promise<string> {
    const values: Record<string, string> = { access_token: token };
    if (caption && !carouselItem) values.caption = caption;
    if (carouselItem) values.is_carousel_item = 'true';
    if (media.kind === 'video') {
      values.media_type = carouselItem ? 'VIDEO' : 'REELS';
      values.video_url = media.url;
    } else {
      values.image_url = media.url;
    }
    const created = await this.instagramPost<{ id?: string }>(`${userId}/media`, values);
    if (!created.id) throw new BadRequestException('Instagram did not return a media container id');
    if (media.kind === 'video') await this.waitForInstagramContainer(created.id, token);
    return created.id;
  }

  private async publishInstagram(post: SocialPost, account: SocialAccount): Promise<string> {
    const userId = String(account.metadata?.instagramUserId || '');
    if (!userId) throw new BadRequestException('Instagram account metadata is incomplete; reconnect the account');
    const scopes = Array.isArray(account.metadata?.scopes) ? (account.metadata.scopes as unknown[]).map(String) : [];
    if (!scopes.includes('instagram_business_content_publish')) {
      throw new BadRequestException('Instagram content publishing permission is not authorized; reconnect Instagram');
    }
    if (!post.mediaUrls.length) throw new BadRequestException('Instagram posts require at least one image or video');
    if (post.mediaUrls.length > 10) throw new BadRequestException('Instagram allows at most 10 carousel items');
    const media = await Promise.all(post.mediaUrls.map((url) => this.resolveMedia(post.ownerId, url)));
    let creationId: string;
    if (media.length === 1) {
      creationId = await this.createInstagramContainer(userId, account.accessToken, media[0], post.content);
    } else {
      const children: string[] = [];
      for (const item of media) children.push(await this.createInstagramContainer(userId, account.accessToken, item, '', true));
      const parent = await this.instagramPost<{ id?: string }>(`${userId}/media`, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: post.content,
        access_token: account.accessToken,
      });
      if (!parent.id) throw new BadRequestException('Instagram did not return a carousel container id');
      creationId = parent.id;
    }
    const published = await this.instagramPost<{ id?: string }>(`${userId}/media_publish`, {
      creation_id: creationId,
      access_token: account.accessToken,
    });
    if (!published.id) throw new BadRequestException('Instagram did not return a published media id');
    account.metadata = { ...(account.metadata || {}), lastSyncedAt: new Date().toISOString() };
    await this.accountRepo.save(account);
    return published.id;
  }

  /** Publish against live provider APIs. Never marks a post published without a provider response. */
  async publishPost(id: string, ownerId: string) {
    const post = await this.getPostById(id, ownerId);
    if (post.status === 'published') return { post, results: [] as PublishResult[] };
    if (post.status === 'publishing') throw new BadRequestException('Post is already publishing');
    post.status = 'publishing';
    await this.postRepo.save(post);

    const allAccounts = await this.accountRepo.find({ where: { ownerId, status: 'connected' }, order: { updatedAt: 'DESC' } });
    const results: PublishResult[] = [];
    const remoteIds = { ...(post.platformPostIds || {}) };
    for (const platform of this.validatePlatforms(post.platforms)) {
      const account = allAccounts.find((item) => this.normalizePlatform(item.platform) === platform);
      if (!account) {
        results.push({ platform, ok: false, error: `No connected ${platform} account` });
        continue;
      }
      try {
        if (platform !== 'instagram') throw new BadRequestException(`Live publishing adapter for ${platform} is not enabled`);
        const remoteId = await this.publishInstagram(post, account);
        remoteIds[platform] = remoteId;
        results.push({ platform, ok: true, remoteId });
      } catch (error) {
        results.push({ platform, ok: false, error: (error as Error).message || 'Publishing failed' });
      }
    }

    post.platformPostIds = remoteIds;
    const allSucceeded = results.length > 0 && results.every((item) => item.ok);
    post.status = allSucceeded ? 'published' : 'failed';
    post.publishedAt = allSucceeded ? new Date() : null;
    await this.postRepo.save(post);
    if (!allSucceeded) {
      this.logger.warn(`Social post ${post.id} failed: ${results.filter((r) => !r.ok).map((r) => `${r.platform}: ${r.error}`).join('; ')}`);
    }
    return { post, results };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async publishDuePosts() {
    const due = await this.postRepo.find({
      where: { status: 'scheduled', scheduledAt: LessThanOrEqual(new Date()) },
      order: { scheduledAt: 'ASC' },
      take: 25,
    });
    for (const post of due) {
      try { await this.publishPost(post.id, post.ownerId); }
      catch (error) { this.logger.warn(`Scheduled post ${post.id} could not publish: ${(error as Error).message}`); }
    }
    return { processed: due.length };
  }

  /* ─────────────── Accounts ─────────────── */

  async createAccount(ownerId: string, dto: CreateSocialAccountDto) {
    if (!dto.accessToken?.trim() || dto.accessToken === 'manual-link') {
      throw new BadRequestException('A real provider OAuth token is required. Use the official Connect flow.');
    }
    const platform = this.normalizePlatform(dto.platform);
    if (!(SUPPORTED_PLATFORMS as readonly string[]).includes(platform)) throw new BadRequestException('Unsupported social platform');
    const saved = await this.accountRepo.save(
      this.accountRepo.create({
        ownerId,
        platform,
        accountName: dto.accountName,
        accountHandle: dto.accountHandle,
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken ?? null,
        tokenExpiresAt: dto.tokenExpiresAt ? new Date(dto.tokenExpiresAt) : null,
        accountAvatar: dto.accountAvatar ?? null,
        metadata: dto.metadata ?? {},
        status: 'connected',
      }),
    );
    return this.safeAccount(saved);
  }

  async getAccounts(ownerId: string) {
    const rows = await this.accountRepo.find({ where: { ownerId }, order: { platform: 'ASC', createdAt: 'DESC' } });
    return rows.map((row) => this.safeAccount(row));
  }

  async disconnectAccount(id: string, ownerId: string) {
    const account = await this.accountRepo.findOne({ where: { id, ownerId } });
    if (!account) throw new NotFoundException('Account not found');
    await this.accountRepo.remove(account);
    return { id };
  }

  /* ─────────────── Analytics ─────────────── */

  async getAnalytics(ownerId: string, filters: AnalyticsFiltersDto) {
    const qb = this.postRepo.createQueryBuilder('post')
      .where('post.ownerId = :ownerId', { ownerId })
      .andWhere("post.status = 'published'");
    if (filters.from) qb.andWhere('post.publishedAt >= :from', { from: new Date(filters.from) });
    if (filters.to) qb.andWhere('post.publishedAt <= :to', { to: new Date(filters.to) });
    const posts = await qb.getMany();
    const filteredPosts = filters.platform
      ? posts.filter((p) => p.platforms.includes(this.normalizePlatform(filters.platform!)))
      : posts;
    const totals = filteredPosts.reduce((acc, post) => {
      const s = post.engagementStats || { likes: 0, comments: 0, shares: 0, impressions: 0 };
      acc.likes += Number(s.likes || 0); acc.comments += Number(s.comments || 0);
      acc.shares += Number(s.shares || 0); acc.impressions += Number(s.impressions || 0);
      return acc;
    }, { likes: 0, comments: 0, shares: 0, impressions: 0 });
    const platformStats: Record<string, { posts: number; likes: number; comments: number; shares: number; impressions: number }> = {};
    for (const post of filteredPosts) {
      for (const platform of post.platforms) {
        platformStats[platform] ??= { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0 };
        const s = post.engagementStats || { likes: 0, comments: 0, shares: 0, impressions: 0 };
        platformStats[platform].posts += 1;
        platformStats[platform].likes += Number(s.likes || 0);
        platformStats[platform].comments += Number(s.comments || 0);
        platformStats[platform].shares += Number(s.shares || 0);
        platformStats[platform].impressions += Number(s.impressions || 0);
      }
    }
    const statusCounts: Record<string, number> = {};
    const allPosts = await this.postRepo.find({ where: { ownerId }, select: ['status'] });
    for (const row of allPosts) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    return { totalPosts: filteredPosts.length, totals, platformBreakdown: platformStats, statusBreakdown: statusCounts };
  }
}
