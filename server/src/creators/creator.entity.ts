import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export interface PlatformStats {
  platform: 'tiktok' | 'instagram' | 'youtube';
  handle: string;
  followers: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  totalPosts: number;
  bestPostViews: number;
  lastSyncedAt: string;
}

export interface FraudSignals {
  lowEngagement: boolean;
  followerSpike: boolean;
  viewFollowerMismatch: boolean;
  /** Composite fraud score 0–100 (higher = more suspicious) */
  fraudScore: number;
  checkedAt: string;
}

@Entity('creators')
export class Creator extends OwnedEntity {
  @Column()
  name!: string;

  @Index({ unique: false })
  @Column()
  handle!: string;

  @Column({ default: '' })
  niche!: string;

  /** Country code e.g. "TZ", "KE" */
  @Column({ default: '' })
  country!: string;

  /** Total followers across all platforms (denormalised for fast search) */
  @Column({ default: 0 })
  followers!: number;

  /** Weighted average engagement rate across platforms */
  @Column({ type: 'float', default: 0 })
  engagement!: number;

  /** Average views across all platforms */
  @Column({ type: 'float', default: 0 })
  avgViews!: number;

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  contactEmail?: string | null;

  /** Mobile money phone number e.g. 255712345678 — used for PalmPesa billing */
  @Column({ nullable: true, type: 'varchar' })
  phone?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  bio?: string | null;

  /** Connected platform identifiers e.g. ["tiktok","instagram"] */
  @Column({ type: 'simple-array', default: '' })
  platforms!: string[];

  /** Per-platform stats stored as JSONB */
  @Column({ type: 'jsonb', default: '[]' })
  platformStats!: PlatformStats[];

  /** Fraud detection signals */
  @Column({ type: 'jsonb', nullable: true })
  fraudSignals?: FraudSignals | null;

  @Column({ default: false })
  verified!: boolean;

  /** Creator's self-reported weekly rate in TZS */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  weeklyRateTzs!: number;

  /** Marketplace visibility tier */
  @Column({ default: 'free' })
  subscriptionTier!: 'free' | 'basic' | 'premium' | 'elite';

  @Column({ nullable: true, type: 'timestamptz' })
  lastSyncedAt?: Date | null;
}
