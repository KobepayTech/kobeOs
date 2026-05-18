import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type CreatorSubStatus =
  | 'pending'    // payment initiated, awaiting USSD confirmation
  | 'active'     // payment confirmed, tier is live
  | 'failed'     // payment failed or timed out
  | 'cancelled'; // manually cancelled

export type CreatorTier = 'free' | 'basic' | 'premium' | 'elite';

/** Weekly prices in TZS */
export const TIER_PRICES: Record<CreatorTier, number> = {
  free:    0,
  basic:   2_000,
  premium: 5_000,
  elite:   10_000,
};

@Entity('creator_subscriptions')
export class CreatorSubscription extends BaseEntity {
  @Index()
  @Column('uuid')
  creatorId!: string;

  /** The tier this payment activates */
  @Column({ default: 'basic' })
  tier!: CreatorTier;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amountTzs!: number;

  /** Our internal transaction ID sent to PalmPesa */
  @Index({ unique: true })
  @Column()
  transactionId!: string;

  /** PalmPesa order_id returned on initiation */
  @Column({ nullable: true, type: 'varchar' })
  palmPesaOrderId?: string | null;

  /** PalmPesa transid from the callback */
  @Column({ nullable: true, type: 'varchar' })
  palmPesaTransId?: string | null;

  /** Mobile money channel used (AIRTELMONEY, MPESA, etc.) */
  @Column({ nullable: true, type: 'varchar' })
  channel?: string | null;

  @Index()
  @Column({ default: 'pending' })
  status!: CreatorSubStatus;

  /** When this subscription period expires (7 days after activation) */
  @Column({ nullable: true, type: 'timestamptz' })
  expiresAt?: Date | null;

  /** Raw PalmPesa callback payload for audit */
  @Column({ type: 'jsonb', nullable: true })
  callbackPayload?: Record<string, unknown> | null;
}
