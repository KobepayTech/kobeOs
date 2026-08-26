import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator, PlatformStats } from './creator.entity';
import { TikTokService } from '../social-scheduler/tiktok.service';
import { OwnedCrudService } from '../common/owned.service';
import { ScrapeCreatorsService } from './scrape-creators.service';
import { MetricsEngineService } from './metrics-engine.service';
import { CreateCreatorDto, SearchCreatorsDto, SyncCreatorDto, UpdateCreatorDto } from './dto/creator.dto';
import { AddReviewDto, SetPackagesDto } from './dto/marketplace.dto';

@Injectable()
export class CreatorsService extends OwnedCrudService<Creator> {
  constructor(
    @InjectRepository(Creator) repo: Repository<Creator>,
    private readonly scraper: ScrapeCreatorsService,
    private readonly metricsEngine: MetricsEngineService,
    private readonly tiktok: TikTokService,
  ) {
    super(repo);
  }

  // ── TikTok account connection (reuses the shared social-scheduler OAuth +
  // encrypted token store; no second TikTok OAuth system) ────────────────────

  /** OAuth URL to connect the creator's TikTok. The creator's owner account is
   * the one the token is stored against, so the whole ecosystem shares it. */
  async tiktokConnectUrl(ownerId: string, id: string) {
    const creator = await this.getOrThrow(ownerId, id);
    return this.tiktok.getOAuthUrl(creator.ownerId);
  }

  /**
   * Normalized connection state for the creator's TikTok, mapped to the spec's
   * vocabulary so the UI never presents stale tokens as live-verified data.
   */
  async tiktokConnection(ownerId: string, id: string) {
    const creator = await this.getOrThrow(ownerId, id);
    const conn = await this.tiktok.getConnection(creator.ownerId);
    if (!conn.connected) return { platform: 'tiktok' as const, state: 'DISCONNECTED' as const };
    const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt).getTime() : 0;
    const now = Date.now();
    const state =
      conn.status === 'disconnected' ? 'REVOKED'
      : conn.status === 'expired' ? 'REFRESH_REQUIRED'
      : expiresAt && expiresAt - now < 24 * 60 * 60_000 ? 'TOKEN_EXPIRING'
      : 'CONNECTED';
    return {
      platform: 'tiktok' as const, state,
      handle: conn.accountHandle, name: conn.accountName, avatar: conn.accountAvatar,
      scopes: conn.scopes, tokenExpiresAt: conn.tokenExpiresAt, lastSyncedAt: conn.lastSyncedAt,
      stats: conn.stats ?? null,
    };
  }

  /**
   * Pull the creator's verified TikTok profile/stats from the connected account
   * into their platformStats, marked as platform-verified (not self-reported).
   */
  async syncFromTikTok(ownerId: string, id: string) {
    const creator = await this.getOrThrow(ownerId, id);
    const conn = await this.tiktok.getConnection(creator.ownerId);
    if (!conn.connected) throw new BadRequestException('Connect TikTok first');
    const stats = (conn.stats ?? {}) as Record<string, number>;
    const followers = Number(stats.follower_count ?? stats.followers ?? 0);
    const entry: PlatformStats = {
      platform: 'tiktok',
      handle: conn.accountHandle || conn.accountName || '',
      followers,
      avgViews: Number(stats.avg_views ?? 0),
      avgLikes: Number(stats.likes_count ?? stats.avg_likes ?? 0),
      avgComments: 0,
      engagementRate: Number(creator.engagement ?? 0),
      totalPosts: Number(stats.video_count ?? 0),
      bestPostViews: 0,
      lastSyncedAt: new Date().toISOString(),
    };
    const others = (creator.platformStats ?? []).filter((s) => s.platform !== 'tiktok');
    creator.platformStats = [...others, entry];
    if (!creator.platforms.includes('tiktok')) creator.platforms = [...creator.platforms, 'tiktok'];
    creator.verified = true;
    if (!creator.avatarUrl && conn.accountAvatar) creator.avatarUrl = conn.accountAvatar;
    creator.followers = others.reduce((sum, s) => sum + Number(s.followers || 0), followers);
    creator.lastSyncedAt = new Date();
    await this.repo.save(creator);
    return this.tiktokConnection(ownerId, id);
  }

  private getOrThrow(ownerId: string, id: string) {
    return super.get(ownerId, id);
  }

  // Typed wrappers so the controller can pass DTOs without casting at call site
  createCreator(ownerId: string, dto: CreateCreatorDto) {
    return super.create(ownerId, dto as unknown as import('typeorm').DeepPartial<Creator>);
  }

  updateCreator(ownerId: string, id: string, dto: UpdateCreatorDto) {
    return super.update(ownerId, id, dto as unknown as import('typeorm').DeepPartial<Creator>);
  }

  /** Marketplace search with filters */
  async search(dto: SearchCreatorsDto) {
    const page  = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, dto.limit ?? 20);

    const qb = this.repo.createQueryBuilder('c')
      .where('c.subscriptionTier != :free', { free: 'free' });

    if (dto.niche)          qb.andWhere('LOWER(c.niche) LIKE :niche', { niche: `%${dto.niche.toLowerCase()}%` });
    if (dto.country)        qb.andWhere('UPPER(c.country) = :country', { country: dto.country.toUpperCase() });
    if (dto.minFollowers)   qb.andWhere('c.followers >= :minF', { minF: dto.minFollowers });
    if (dto.minEngagement)  qb.andWhere('c.engagement >= :minE', { minE: dto.minEngagement });
    if (dto.minAvgViews)    qb.andWhere('c."avgViews" >= :minV', { minV: dto.minAvgViews });
    if (dto.tier)           qb.andWhere('c.subscriptionTier = :tier', { tier: dto.tier });

    // Rank: elite first, then premium, then basic; within tier sort by engagement desc
    qb.orderBy(`CASE c.subscriptionTier
        WHEN 'elite'   THEN 1
        WHEN 'premium' THEN 2
        WHEN 'basic'   THEN 3
        ELSE 4 END`, 'ASC')
      .addOrderBy('c.engagement', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return qb.getMany();
  }

  /** Connect a platform and pull live stats */
  async syncPlatform(ownerId: string, creatorId: string, dto: SyncCreatorDto) {
    const creator = await this.get(ownerId, creatorId);

    // Add platform to list if not already there
    if (!creator.platforms.includes(dto.platform)) {
      creator.platforms = [...creator.platforms.filter(Boolean), dto.platform];
    }

    // Fetch live stats
    let kit;
    if (dto.platform === 'tiktok')         kit = await this.scraper.fetchTikTok(dto.handle);
    else if (dto.platform === 'instagram') kit = await this.scraper.fetchInstagram(dto.handle);
    else                                   kit = await this.scraper.fetchYouTube(dto.handle);

    // Merge into platformStats
    const otherStats = creator.platformStats.filter((s) => s.platform !== dto.platform);
    const allStats = [...otherStats, kit.stats];

    const totalFollowers = allStats.reduce((s, p) => s + p.followers, 0);
    const avgEngagement  = allStats.reduce((s, p) => s + p.engagementRate, 0) / allStats.length;
    const avgViews       = allStats.reduce((s, p) => s + p.avgViews, 0) / allStats.length;
    const fraudSignals   = this.metricsEngine.computeFraudSignals(allStats, creator.fraudSignals ?? undefined);

    return this.repo.save({
      ...creator,
      platforms: creator.platforms,
      platformStats: allStats,
      followers: totalFollowers,
      engagement: parseFloat(avgEngagement.toFixed(2)),
      avgViews: parseFloat(avgViews.toFixed(0)),
      avatarUrl: creator.avatarUrl ?? kit.avatarUrl,
      fraudSignals,
      lastSyncedAt: new Date(),
    });
  }

  // ── Reviews ─────────────────────────────────────────────────────────────────

  async addReview(_userId: string, dto: AddReviewDto) {
    const creator = await this.repo.findOne({ where: { id: dto.creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    const review = {
      id: crypto.randomUUID(),
      brandName: dto.brandName,
      rating: dto.rating,
      comment: dto.comment,
      campaignName: dto.campaignName,
      date: new Date().toISOString(),
    };

    creator.reviews = [...(creator.reviews ?? []), review];
    await this.repo.save(creator);
    return review;
  }

  async getReviews(creatorId: string) {
    const creator = await this.repo.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator.reviews ?? [];
  }

  // ── Packages ────────────────────────────────────────────────────────────────

  async setPackages(userId: string, dto: SetPackagesDto) {
    const creator = await this.repo.findOne({ where: { ownerId: userId } });
    if (!creator) throw new NotFoundException('Creator profile not found for this user');

    creator.packages = dto.packages ?? [];
    return this.repo.save(creator);
  }

  async getPackages(creatorId: string) {
    const creator = await this.repo.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator.packages ?? [];
  }

  // ── Media kit ───────────────────────────────────────────────────────────────

  /** Public media kit — no auth required */
  async getMediaKit(creatorId: string) {
    const creator = await this.repo.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');
    return {
      id: creator.id,
      name: creator.name,
      handle: creator.handle,
      bio: creator.bio,
      niche: creator.niche,
      country: creator.country,
      avatarUrl: creator.avatarUrl,
      verified: creator.verified,
      followers: creator.followers,
      engagement: creator.engagement,
      avgViews: creator.avgViews,
      platforms: creator.platforms,
      platformStats: creator.platformStats,
      weeklyRateTzs: creator.weeklyRateTzs,
      subscriptionTier: creator.subscriptionTier,
      fraudScore: creator.fraudSignals?.fraudScore ?? 0,
    };
  }
}
