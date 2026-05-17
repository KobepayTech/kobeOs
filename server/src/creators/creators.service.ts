import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator } from './creator.entity';
import { OwnedCrudService } from '../common/owned.service';
import { ScrapeCreatorsService } from './scrape-creators.service';
import { MetricsEngineService } from './metrics-engine.service';
import { CreateCreatorDto, SearchCreatorsDto, SyncCreatorDto, UpdateCreatorDto } from './dto/creator.dto';

@Injectable()
export class CreatorsService extends OwnedCrudService<Creator> {
  constructor(
    @InjectRepository(Creator) repo: Repository<Creator>,
    private readonly scraper: ScrapeCreatorsService,
    private readonly metricsEngine: MetricsEngineService,
  ) {
    super(repo);
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
