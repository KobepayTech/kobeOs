import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

/**
 * The creator-commerce attribution spine. Ties a creator's off-platform content
 * (a TikTok video, an Instagram reel, a shared link) to a real KobeOS product
 * and to the actual Jumla/website orders it generates, so a creator's headline
 * metric becomes "verified sales generated", not follower count.
 *
 *   AttributionLink  →  Click  →  Jumla order  →  Sale  →  Commission  →  Payout
 */

export type AttributionDestination = 'jumla' | 'store' | 'url';

/**
 * A unique, shareable link a creator posts (e.g. kobe.app/c/AB12CD). Resolving
 * it records a click and redirects to the real destination (a Jumla product, a
 * merchant storefront, or an external URL) carrying the attribution code so the
 * eventual order can be tied back to this creator + campaign.
 */
@Entity('creator_attribution_links')
export class CreatorAttributionLink extends OwnedEntity {
  /** ownerId = the advertiser/merchant who created the promotion. */

  @Index({ unique: true })
  @Column()
  code!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  campaignId?: string | null;

  @Index()
  @Column('uuid')
  creatorId!: string;

  /** The real KobeOS product being promoted (never a duplicated catalogue row). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  productId?: string | null;

  @Column({ default: 'jumla' })
  destination!: AttributionDestination;

  /** Absolute or app-relative URL the click redirects to. */
  @Column({ type: 'text', default: '' })
  destinationUrl!: string;

  /** Commission rate (%) paid to the creator on completed attributed sales. */
  @Column({ type: 'float', default: 0 })
  commissionPercent!: number;

  /** Optional creator discount code (e.g. AMINA10) as a second attribution path. */
  @Column({ default: '' })
  promoCode!: string;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'int', default: 0 })
  clicks!: number;

  @Column({ default: true })
  active!: boolean;
}

export type AttributionEventType = 'CLICK' | 'CART' | 'ORDER' | 'SALE' | 'REVERSED';

/** Append-only funnel log for a link: click → cart → order → sale (or reversed). */
@Entity('creator_attribution_events')
export class CreatorAttributionEvent extends BaseEntity {
  @Index()
  @Column('uuid')
  linkId!: string;

  @Column()
  code!: string;

  @Index()
  @Column()
  type!: AttributionEventType;

  /** Anonymous per-visitor tracking id issued at click time. */
  @Index()
  @Column({ default: '' })
  clickId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  revenue!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}

/**
 * Commission owed to a creator for an attributed order.
 *
 *   PENDING  — order submitted, sale not yet completed
 *   EARNED   — order completed; commission is owed
 *   PAYABLE  — batched and ready to pay out
 *   PAID     — settled to the creator
 *   REVERSED — order cancelled/refunded/fraudulent; no commission owed
 */
export type CommissionState = 'PENDING' | 'EARNED' | 'PAYABLE' | 'PAID' | 'REVERSED';

@Entity('creator_commissions')
@Index('UQ_creator_commission_order_link', ['orderId', 'linkId'], { unique: true })
export class CreatorCommission extends BaseEntity {
  @Index()
  @Column('uuid')
  linkId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  campaignId?: string | null;

  @Index()
  @Column('uuid')
  creatorId!: string;

  /** The advertiser/merchant who owes the commission (link owner). */
  @Index()
  @Column('uuid')
  ownerId!: string;

  @Index()
  @Column('uuid')
  orderId!: string;

  @Column({ type: 'uuid', nullable: true })
  productId?: string | null;

  /** Order revenue the commission is computed from. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  baseAmount!: number;

  @Column({ type: 'float', default: 0 })
  rate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Index()
  @Column({ default: 'PENDING' })
  state!: CommissionState;

  @Column({ type: 'timestamptz', nullable: true })
  earnedAt?: Date | null;
}

export const CREATOR_COMMERCE_ENTITIES = [
  CreatorAttributionLink,
  CreatorAttributionEvent,
  CreatorCommission,
];
