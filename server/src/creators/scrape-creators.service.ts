import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformStats } from './creator.entity';

// ── Raw API response shapes (only fields we use) ─────────────────────────────

interface TikTokProfileResponse {
  user: {
    uniqueId: string;
    nickname: string;
    avatarLarger: string;
    signature: string;
    verified: boolean;
  };
  stats: {
    followerCount: number;
    heartCount: number;
    videoCount: number;
  };
}

interface InstagramProfileResponse {
  success: boolean;
  data: {
    user: {
      username: string;
      full_name: string;
      biography: string;
      profile_pic_url_hd: string;
      is_verified: boolean;
      edge_followed_by: { count: number };
      edge_follow: { count: number };
      edge_owner_to_timeline_media: {
        count: number;
        edges: Array<{
          node: {
            is_video: boolean;
            video_view_count?: number;
            edge_liked_by: { count: number };
            edge_media_to_comment: { count: number };
          };
        }>;
      };
    };
  };
}

interface YouTubeChannelResponse {
  channelId: string;
  name: string;
  avatar: { image: { sources: Array<{ url: string }> } };
  description: string;
  subscriberCount: number;
  videoCountText: string;
  country?: string;
}

// ── Normalised media kit returned to callers ──────────────────────────────────

export interface MediaKit {
  platform: 'tiktok' | 'instagram' | 'youtube';
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string;
  verified: boolean;
  stats: PlatformStats;
}

@Injectable()
export class ScrapeCreatorsService {
  private readonly logger = new Logger(ScrapeCreatorsService.name);
  private readonly base = 'https://api.scrapecreators.com';
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SCRAPE_CREATORS_API_KEY', '');
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async fetchTikTok(handle: string): Promise<MediaKit> {
    const raw = await this.get<TikTokProfileResponse>('/v1/tiktok/profile', { handle });
    const { user, stats } = raw;

    // Estimate avg views from total hearts / video count (rough proxy)
    const avgViews = stats.videoCount > 0
      ? Math.round(stats.heartCount / stats.videoCount * 0.3)
      : 0;

    const engagementRate = stats.followerCount > 0
      ? parseFloat(((stats.heartCount / stats.videoCount / stats.followerCount) * 100).toFixed(2))
      : 0;

    return {
      platform: 'tiktok',
      handle: user.uniqueId,
      name: user.nickname,
      bio: user.signature,
      avatarUrl: user.avatarLarger,
      verified: user.verified,
      stats: {
        platform: 'tiktok',
        handle: user.uniqueId,
        followers: stats.followerCount,
        avgViews,
        avgLikes: stats.videoCount > 0 ? Math.round(stats.heartCount / stats.videoCount) : 0,
        avgComments: 0,
        engagementRate,
        totalPosts: stats.videoCount,
        bestPostViews: 0,
        lastSyncedAt: new Date().toISOString(),
      },
    };
  }

  async fetchInstagram(handle: string): Promise<MediaKit> {
    const raw = await this.get<InstagramProfileResponse>('/v1/instagram/profile', { handle });
    const u = raw.data.user;

    const posts = u.edge_owner_to_timeline_media.edges;
    const videoPosts = posts.filter((p) => p.node.is_video);
    const totalViews = videoPosts.reduce((s, p) => s + (p.node.video_view_count ?? 0), 0);
    const avgViews = videoPosts.length > 0 ? Math.round(totalViews / videoPosts.length) : 0;
    const avgLikes = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + p.node.edge_liked_by.count, 0) / posts.length)
      : 0;
    const avgComments = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + p.node.edge_media_to_comment.count, 0) / posts.length)
      : 0;
    const followers = u.edge_followed_by.count;
    const engagementRate = followers > 0
      ? parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2))
      : 0;
    const bestPostViews = videoPosts.reduce((m, p) => Math.max(m, p.node.video_view_count ?? 0), 0);

    return {
      platform: 'instagram',
      handle: u.username,
      name: u.full_name,
      bio: u.biography,
      avatarUrl: u.profile_pic_url_hd,
      verified: u.is_verified,
      stats: {
        platform: 'instagram',
        handle: u.username,
        followers,
        avgViews,
        avgLikes,
        avgComments,
        engagementRate,
        totalPosts: u.edge_owner_to_timeline_media.count,
        bestPostViews,
        lastSyncedAt: new Date().toISOString(),
      },
    };
  }

  async fetchYouTube(handle: string): Promise<MediaKit> {
    const raw = await this.get<YouTubeChannelResponse>('/v1/youtube/channel', { handle });

    const avatarUrl = raw.avatar?.image?.sources?.[raw.avatar.image.sources.length - 1]?.url ?? '';
    const videoCount = parseInt(raw.videoCountText?.replace(/[^0-9]/g, '') ?? '0', 10) || 0;

    return {
      platform: 'youtube',
      handle,
      name: raw.name,
      bio: raw.description,
      avatarUrl,
      verified: false,
      stats: {
        platform: 'youtube',
        handle,
        followers: raw.subscriberCount,
        avgViews: 0, // requires video-level data; populated by MetricsEngine
        avgLikes: 0,
        avgComments: 0,
        engagementRate: 0,
        totalPosts: videoCount,
        bestPostViews: 0,
        lastSyncedAt: new Date().toISOString(),
      },
    };
  }

  // ── Internal HTTP helper ────────────────────────────────────────────────────

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('SCRAPE_CREATORS_API_KEY is not configured');
    }

    const url = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    this.logger.debug(`GET ${url.toString()}`);

    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': this.apiKey },
    });

    if (res.status === 402) {
      throw new ServiceUnavailableException('ScrapeCreators credits exhausted');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `ScrapeCreators ${path} returned ${res.status}: ${body.slice(0, 200)}`,
      );
    }

    return res.json() as Promise<T>;
  }
}
