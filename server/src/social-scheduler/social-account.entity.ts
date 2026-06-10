import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * A connected social media account (e.g. Instagram, Twitter/X, Facebook,
 * LinkedIn, YouTube, TikTok, Pinterest, Threads, Bluesky, Mastodon).
 * Stores OAuth tokens and account metadata for publishing on the owner's
 * behalf.
 */
@Entity('social_accounts')
export class SocialAccount extends BaseEntity {
  @Index()
  @Column('uuid')
  ownerId!: string;

  /** Platform key — e.g. 'instagram', 'twitter', 'facebook', 'linkedin' */
  @Column()
  platform!: string;

  /** Human-readable account name (e.g. "KobeOS Official") */
  @Column()
  accountName!: string;

  /** Platform handle/username (e.g. "@kobeos") */
  @Column()
  accountHandle!: string;

  /** OAuth access token for API calls */
  @Column({ type: 'text' })
  accessToken!: string;

  /** OAuth refresh token (nullable for platforms that don't use refresh) */
  @Column({ type: 'text', nullable: true })
  refreshToken!: string | null;

  /** When the access token expires — null if no expiry */
  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  /** Connection state: connected | expired | disconnected */
  @Column({ default: 'connected' })
  status!: 'connected' | 'expired' | 'disconnected';

  /** Avatar/profile image URL */
  @Column({ type: 'text', nullable: true })
  accountAvatar!: string | null;

  /** Extra platform-specific metadata (user ID, page ID, scopes, etc.) */
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
