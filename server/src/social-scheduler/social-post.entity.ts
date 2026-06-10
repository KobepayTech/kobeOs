import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Represents a social media post that can be drafted, scheduled, or published.
 * Supports multi-platform publishing (Instagram, Twitter/X, Facebook, LinkedIn,
 * YouTube, TikTok, Pinterest, Threads, Bluesky, Mastodon).
 */
@Entity('social_posts')
export class SocialPost extends BaseEntity {
  @Index()
  @Column('uuid')
  ownerId!: string;

  /** Post content/caption — max 2000 chars across all platforms */
  @Column({ type: 'text' })
  content!: string;

  /** Platforms to publish to — stored as comma-separated values */
  @Column('simple-array')
  platforms!: string[];

  /** URLs of uploaded media (images, videos) attached to the post */
  @Column('simple-array', { default: '' })
  mediaUrls!: string[];

  /** When the post should be published (null = draft, no schedule) */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  /** Publication lifecycle state */
  @Index()
  @Column({
    type: 'enum',
    enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'],
    default: 'draft',
  })
  status!: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

  /** When the post was actually published (null until then) */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  /** Aggregated engagement metrics from all platforms */
  @Column({ type: 'jsonb', default: {} })
  engagementStats!: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
  };

  /** Maps platform name -> remote post ID after publishing */
  @Column({ type: 'jsonb', default: {} })
  platformPostIds!: Record<string, string>;
}
