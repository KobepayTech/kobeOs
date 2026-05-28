import { Column, Entity, Index } from 'typeorm';
import { IsEnum } from 'class-validator';
import { BaseEntity } from '../common/base.entity';

export type DisputeStatus = 'open' | 'under_review' | 'resolved_creator' | 'resolved_brand' | 'resolved_split' | 'closed';
export type DisputeType = 'kpi_not_met' | 'payment_not_received' | 'content_rejected' | 'fraud' | 'other';

export interface DisputeMessage {
  authorId: string;
  authorRole: string;
  message: string;
  attachments: string[];
  sentAt: string;
}

@Entity('disputes')
export class Dispute extends BaseEntity {
  /** User who raised the dispute */
  @Index()
  @Column('uuid')
  raisedBy!: string;

  /** The other party */
  @Index()
  @Column('uuid')
  againstUserId!: string;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  campaignId?: string | null;

  @Column({ nullable: true, type: 'uuid' })
  escrowId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  txnReference?: string | null;

  @IsEnum(['kpi_not_met', 'payment_not_received', 'content_rejected', 'fraud', 'other'])
  @Column({ default: 'other' })
  type!: DisputeType;

  @Index()
  @Column({ default: 'open' })
  status!: DisputeStatus;

  @Column({ type: 'text' })
  description!: string;

  /** Evidence URLs (screenshots, links, etc.) */
  @Column({ type: 'simple-array', default: '' })
  evidence!: string[];

  /** Thread of messages between parties + admin */
  @Column({ type: 'jsonb', default: '[]' })
  messages!: DisputeMessage[];

  /** Admin who is handling this dispute */
  @Column({ nullable: true, type: 'uuid' })
  assignedTo?: string | null;

  /** Resolution notes written by admin */
  @Column({ type: 'text', default: '' })
  resolution!: string;

  /** Amount refunded to brand (TZS) if split/resolved_brand */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  refundAmountTzs!: number;

  /** Amount released to creator (TZS) if split/resolved_creator */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  releaseAmountTzs!: number;

  @Column({ nullable: true, type: 'timestamptz' })
  resolvedAt?: Date | null;
}

// Inline decorator to avoid circular import — just a no-op for TS
function IsDisputeType() { return () => {}; }
