import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type EscrowStatus =
  | 'held'      // funds locked, waiting for KPI verification
  | 'released'  // funds sent to creator
  | 'refunded'  // funds returned to advertiser
  | 'disputed'; // under manual review

@Entity('creator_escrow')
export class CreatorEscrow extends BaseEntity {
  /** Advertiser user ID */
  @Index()
  @Column('uuid')
  advertiserId!: string;

  /** Creator user ID */
  @Index()
  @Column('uuid')
  creatorId!: string;

  @Index()
  @Column('uuid')
  campaignId!: string;

  /** Offer ID within the campaign */
  @Column('uuid')
  offerId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amountTzs!: number;

  /** Platform fee deducted on release (TZS) */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  feeTzs!: number;

  /** Net amount creator receives after fee */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  netAmountTzs!: number;

  @Index()
  @Column({ default: 'held' })
  status!: EscrowStatus;

  /** Kobepay wallet ID funds were debited from (advertiser) */
  @Column({ nullable: true, type: 'uuid' })
  advertiserWalletId?: string | null;

  /** Kobepay wallet ID funds were credited to (creator) */
  @Column({ nullable: true, type: 'uuid' })
  creatorWalletId?: string | null;

  /** Transaction ID of the hold debit */
  @Column({ nullable: true, type: 'uuid' })
  holdTxId?: string | null;

  /** Transaction ID of the release credit */
  @Column({ nullable: true, type: 'uuid' })
  releaseTxId?: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  releasedAt?: Date | null;

  @Column({ nullable: true, type: 'timestamptz' })
  refundedAt?: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  notes?: string | null;
}
