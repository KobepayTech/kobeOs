import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type MobileSubStatus = 'trialing' | 'active' | 'expired' | 'pending' | 'failed';

/** Monthly price for mobile-workspace access, in TZS. */
export const MOBILE_SUB_PRICE_TZS = 100_000;
/** Free trial length before the paywall: 48 hours. */
export const MOBILE_TRIAL_MS = 48 * 60 * 60 * 1000;
/** Paid period length granted per successful payment: 30 days. */
export const MOBILE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Per-SHOP subscription that gates the /m/:slug mobile workspace.
 *
 * Keyed by `slug` (e.g. "johsport") so one 48h trial + one paid subscription
 * covers everyone who signs into that shop's mobile workspace — not per user.
 * Any signed-in staff member can pay to unlock it for the whole shop.
 */
@Entity('mobile_subscriptions')
export class MobileSubscription extends BaseEntity {
  /** The shop slug this subscription gates. Unique — one record per shop. */
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Index()
  @Column({ default: 'trialing' })
  status!: MobileSubStatus;

  /** End of the free 48h trial (set when the shop is first seen). */
  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt?: Date | null;

  /** End of the current PAID period (set 30 days out on a completed payment). */
  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEndsAt?: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  amountTzs!: number;

  /** Our reference sent to PalmPesa (prefixed "msub_") — callback lookup key. */
  @Index()
  @Column({ nullable: true, type: 'varchar' })
  transactionId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  palmPesaOrderId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  palmPesaTransId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  channel?: string | null;

  /** Account that initiated the most recent payment (audit only). */
  @Column({ nullable: true, type: 'uuid' })
  lastPaidByUserId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload?: Record<string, unknown> | null;
}
