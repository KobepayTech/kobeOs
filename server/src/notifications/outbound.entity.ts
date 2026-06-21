import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Outbound message campaign — a single "blast" to many recipients.
 * Persisted so the operator can browse send history, debug failures,
 * and re-run a campaign without re-typing the body.
 */
@Entity('outbound_campaigns')
export class OutboundCampaign extends OwnedEntity {
  @Index()
  @Column({ length: 16 })
  channel!: 'sms' | 'whatsapp';

  /** Free-text SMS body, or for WhatsApp the template name (the rendered
   *  text per-recipient lives on OutboundMessage). */
  @Column({ type: 'text' })
  body!: string;

  /** WhatsApp only: Meta-approved template name. SMS leaves this null. */
  @Column({ nullable: true, type: 'varchar' })
  templateName?: string | null;

  /** WhatsApp only: language code for the template ("en", "sw", etc). */
  @Column({ nullable: true, type: 'varchar' })
  templateLanguage?: string | null;

  @Column({ default: 0 })
  recipientCount!: number;

  @Column({ default: 0 })
  sentCount!: number;

  @Column({ default: 0 })
  failedCount!: number;

  @Index()
  @Column({ default: 'PENDING' })
  status!: 'PENDING' | 'SENDING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;
}

@Entity('outbound_messages')
export class OutboundMessage extends OwnedEntity {
  @Index()
  @Column('uuid')
  campaignId!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  customerName?: string | null;

  /** Per-recipient rendered body — for SMS this matches campaign.body;
   *  for WhatsApp templates with variables this is the substituted text
   *  so the audit log shows exactly what each customer received. */
  @Column({ type: 'text' })
  body!: string;

  @Index()
  @Column({ default: 'PENDING' })
  status!: 'PENDING' | 'SENT' | 'FAILED';

  @Column({ nullable: true, type: 'text' })
  error?: string | null;

  /** Beem's per-recipient request id, returned in the send response.
   *  Lets us correlate later if we wire delivery webhooks. */
  @Column({ nullable: true, type: 'varchar' })
  externalId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date | null;
}
