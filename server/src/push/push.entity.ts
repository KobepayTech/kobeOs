import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Web Push subscription, persisted per (phone, endpoint). One phone
 * can have many endpoints (one per device the customer logs into the
 * portal from). Endpoint uniqueness is what dedupes — same Chrome on
 * same device returns the same endpoint URL.
 *
 * Not OwnedEntity — this is customer-side data keyed by phone, not
 * by an operator tenant. The dispatcher fans messages out per phone.
 */
@Entity('push_subscriptions')
@Index(['phone', 'endpoint'], { unique: true })
export class PushSubscription extends BaseEntity {
  @Index()
  @Column()
  phone!: string;

  @Column({ type: 'text' })
  endpoint!: string;

  /** Per-subscription P-256 ECDH public key (Base64URL). */
  @Column({ type: 'text' })
  p256dh!: string;

  /** Per-subscription auth secret (Base64URL). */
  @Column({ type: 'text' })
  auth!: string;

  /** UA the customer subscribed from — purely for the audit list
   *  ("you have 2 active devices: iPhone, Pixel"). */
  @Column({ type: 'text', default: '' })
  userAgent!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt?: Date | null;

  /** Counter incremented on every consecutive 410-Gone from the push
   *  service. After a few failures we delete the row — the customer
   *  uninstalled the browser, declined permission, or wiped data. */
  @Column({ default: 0 })
  failureCount!: number;
}
