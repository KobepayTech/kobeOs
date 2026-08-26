import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type CampaignStatus =
  | 'draft'       // advertiser building the campaign
  | 'open'        // accepting creator applications
  | 'in_progress' // at least one offer accepted, content being created
  | 'verifying'   // metrics engine checking KPIs
  | 'completed'   // all requirements met, funds released
  | 'cancelled'   // cancelled before completion
  | 'disputed';   // creator or advertiser raised a dispute

export type OfferStatus =
  | 'pending'    // sent, awaiting creator response
  | 'accepted'   // creator accepted
  | 'declined'   // creator declined
  | 'negotiating'// counter-offer in flight
  | 'active'     // content being created
  | 'submitted'  // creator submitted proof
  | 'verified'   // metrics engine confirmed KPIs
  | 'paid'       // escrow released to creator
  | 'failed';    // KPIs not met within deadline

export interface CampaignRequirement {
  platform: 'tiktok' | 'instagram' | 'youtube';
  contentType: 'video' | 'reel' | 'story' | 'post';
  minViews: number;
  minLikes?: number;
  deadline: string; // ISO date
  description?: string;
}

export interface CreatorOffer {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  amountTzs: number;
  status: OfferStatus;
  /** Proof URLs submitted by creator */
  proofUrls: string[];
  /** Verified metric values after campaign */
  verifiedViews?: number;
  verifiedLikes?: number;
  sentAt: string;
  respondedAt?: string;
  verifiedAt?: string;
  paidAt?: string;
  notes?: string;
}

// NB: a distinct table from the legacy marketing `campaigns` (discounts module).
// Sharing that name silently broke every creator-campaign insert in production
// (the marketing table's NOT NULL startDate/endDate were never satisfied).
@Entity('creator_campaigns')
export class Campaign extends OwnedEntity {
  /** ownerId = advertiser's user ID */

  @Column()
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ default: '' })
  brand!: string;

  @Column({ default: '' })
  niche!: string;

  @Index()
  @Column({ default: 'draft' })
  status!: CampaignStatus;

  /** Total campaign budget in TZS */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  budgetTzs!: number;

  /** Platform fee % taken by Kobepay (default 10%) */
  @Column({ type: 'float', default: 10 })
  platformFeePercent!: number;

  /** Content requirements per creator */
  @Column({ type: 'jsonb', default: '[]' })
  requirements!: CampaignRequirement[];

  /** Offers sent to creators */
  @Column({ type: 'jsonb', default: '[]' })
  offers!: CreatorOffer[];

  /** ISO date campaign closes for new applications */
  @Column({ nullable: true, type: 'timestamptz' })
  endsAt?: Date | null;

  /** Escrow record ID once funds are locked */
  @Column({ nullable: true, type: 'uuid' })
  escrowId?: string | null;

  // ── Product-linked promotion ("Promote With Creators") ─────────────────────
  // A campaign spawned from a real KobeOS product references it directly — the
  // product is never recreated inside the creator marketplace.
  @Index()
  @Column({ nullable: true, type: 'uuid' })
  productId?: string | null;

  @Column({ default: '' })
  productName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  productPrice!: number;

  /** Commission (%) paid to the creator per completed attributed sale. */
  @Column({ type: 'float', default: 0 })
  commissionPercent!: number;

  /** Where a creator link for this campaign should send buyers. */
  @Column({ default: 'jumla' })
  destination!: 'jumla' | 'store' | 'url';

  @Column({ type: 'text', default: '' })
  destinationUrl!: string;
}
