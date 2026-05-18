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

@Entity('campaigns')
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
}
