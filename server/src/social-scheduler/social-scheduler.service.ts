import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SocialPost } from './social-post.entity';
import { SocialAccount } from './social-account.entity';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
  PostFiltersDto,
  CreateSocialAccountDto,
  AnalyticsFiltersDto,
} from './dto/social-post.dto';

@Injectable()
export class SocialSchedulerService {
  constructor(
    @InjectRepository(SocialPost)
    private readonly postRepo: Repository<SocialPost>,
    @InjectRepository(SocialAccount)
    private readonly accountRepo: Repository<SocialAccount>,
  ) {}

  /* ─────────────── Posts ─────────────── */

  /** Create a new social post (draft or scheduled). */
  async createPost(ownerId: string, dto: CreateSocialPostDto) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const status = dto.status ?? (scheduledAt ? 'scheduled' : 'draft');
    return this.postRepo.save(
      this.postRepo.create({
        ownerId,
        content: dto.content,
        platforms: dto.platforms ?? [],
        mediaUrls: dto.mediaUrls ?? [],
        scheduledAt,
        status: status as SocialPost['status'],
      }),
    );
  }

  /** List posts for an owner with optional filters. */
  async getPosts(ownerId: string, filters: PostFiltersDto) {
    const page = Math.max(1, parseInt(filters.page ?? '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit ?? '50', 10)));

    const where: Record<string, unknown> = { ownerId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.platform) {
      // simple-array is stored as comma-separated; use ILIKE for platform match
      where.platforms = filters.platform;
    }

    if (filters.from || filters.to) {
      const from = filters.from ? new Date(filters.from) : new Date(0);
      const to = filters.to ? new Date(filters.to) : new Date(8640000000000000);
      where.scheduledAt = Between(from, to);
    }

    const [items, total] = await this.postRepo.findAndCount({
      where,
      order: { scheduledAt: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /** Get a single post by ID, verifying ownership. */
  async getPostById(id: string, ownerId: string) {
    const post = await this.postRepo.findOne({ where: { id, ownerId } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  /** Update an existing post. */
  async updatePost(id: string, ownerId: string, dto: UpdateSocialPostDto) {
    const post = await this.getPostById(id, ownerId);

    if (dto.content !== undefined) post.content = dto.content;
    if (dto.platforms !== undefined) post.platforms = dto.platforms;
    if (dto.mediaUrls !== undefined) post.mediaUrls = dto.mediaUrls;
    if (dto.scheduledAt !== undefined) post.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.status !== undefined) post.status = dto.status as SocialPost['status'];

    return this.postRepo.save(post);
  }

  /** Delete a post permanently. */
  async deletePost(id: string, ownerId: string) {
    const post = await this.getPostById(id, ownerId);
    await this.postRepo.remove(post);
    return { id };
  }

  /** Simulate publishing a post now (marks as published). */
  async publishPost(id: string) {
    const post = await this.postRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    post.status = 'published';
    post.publishedAt = new Date();

    return this.postRepo.save(post);
  }

  /* ─────────────── Accounts ─────────────── */

  /** Connect a new social media account. */
  async createAccount(ownerId: string, dto: CreateSocialAccountDto) {
    return this.accountRepo.save(
      this.accountRepo.create({
        ownerId,
        platform: dto.platform,
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
  }

  /** List all connected social accounts for an owner. */
  getAccounts(ownerId: string) {
    return this.accountRepo.find({
      where: { ownerId },
      order: { platform: 'ASC', createdAt: 'DESC' },
    });
  }

  /** Disconnect (delete) a social account. */
  async disconnectAccount(id: string, ownerId: string) {
    const account = await this.accountRepo.findOne({ where: { id, ownerId } });
    if (!account) throw new NotFoundException('Account not found');
    await this.accountRepo.remove(account);
    return { id };
  }

  /* ─────────────── Analytics ─────────────── */

  /** Get aggregated post analytics for an owner. */
  async getAnalytics(ownerId: string, filters: AnalyticsFiltersDto) {
    const qb = this.postRepo.createQueryBuilder('post')
      .where('post.ownerId = :ownerId', { ownerId })
      .andWhere("post.status = 'published'");

    if (filters.from) {
      qb.andWhere('post.publishedAt >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('post.publishedAt <= :to', { to: new Date(filters.to) });
    }

    const posts = await qb.getMany();

    // If platform filter is provided, only count posts that include that platform
    const filteredPosts = filters.platform
      ? posts.filter((p) => p.platforms.includes(filters.platform!))
      : posts;

    // Aggregate engagement stats
    const totals = filteredPosts.reduce(
      (acc, post) => {
        const s = post.engagementStats;
        acc.likes += s.likes ?? 0;
        acc.comments += s.comments ?? 0;
        acc.shares += s.shares ?? 0;
        acc.impressions += s.impressions ?? 0;
        return acc;
      },
      { likes: 0, comments: 0, shares: 0, impressions: 0 },
    );

    // Per-platform breakdown
    const platformStats: Record<string, { posts: number; likes: number; comments: number; shares: number; impressions: number }> = {};
    for (const post of filteredPosts) {
      for (const platform of post.platforms) {
        if (!platformStats[platform]) {
          platformStats[platform] = { posts: 0, likes: 0, comments: 0, shares: 0, impressions: 0 };
        }
        const s = post.engagementStats;
        platformStats[platform].posts += 1;
        platformStats[platform].likes += s.likes ?? 0;
        platformStats[platform].comments += s.comments ?? 0;
        platformStats[platform].shares += s.shares ?? 0;
        platformStats[platform].impressions += s.impressions ?? 0;
      }
    }

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    const allPosts = await this.postRepo.find({ where: { ownerId }, select: ['status'] });
    for (const post of allPosts) {
      statusCounts[post.status] = (statusCounts[post.status] ?? 0) + 1;
    }

    return {
      totalPosts: filteredPosts.length,
      totals,
      platformBreakdown: platformStats,
      statusBreakdown: statusCounts,
    };
  }
}
