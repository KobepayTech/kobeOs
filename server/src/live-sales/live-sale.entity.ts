import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Live-commerce ("live sale") — sell during an Instagram/TikTok/Facebook
 * live. A session pins products with a short buy-code + live price; buyer
 * comments are ingested (from the assisted console, an external bridge, or
 * a future official webhook), parsed for a code, and one tap turns a comment
 * into a real order that atomically decrements stock and can push a PalmPesa
 * payment request to the buyer.
 */
export type LivePlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'other';
export type LiveStatus = 'LIVE' | 'ENDED';

@Entity('live_sessions')
@Index(['ownerId', 'status'])
export class LiveSession extends OwnedEntity {
  @Column({ default: 'Live Sale' })
  title!: string;

  @Column({ default: 'other' })
  platform!: LivePlatform;

  @Column({ default: 'LIVE' })
  status!: LiveStatus;

  /** Opaque token an external comment-bridge uses to POST into the public
   *  ingest endpoint without a JWT. Rotated by starting a new session. */
  @Index({ unique: true })
  @Column()
  ingestToken!: string;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalSales!: number;

  @Column({ default: 0 })
  orderCount!: number;

  /** When true, an active session appears as a shoppable "LIVE" banner on
   *  the owner's online storefront — so web customers can buy the live at
   *  the live price too, not just viewers on TikTok/Instagram. */
  @Column({ default: true })
  showOnStorefront!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date | null;
}

@Entity('live_pins')
@Index(['ownerId', 'sessionId'])
@Index(['sessionId', 'code'], { unique: true })
export class LivePin extends OwnedEntity {
  @Index()
  @Column('uuid')
  sessionId!: string;

  @Index()
  @Column('uuid')
  productId!: string;

  /** Short buy-code shouted on the live, e.g. "A1" or "BUY101". Upper-cased. */
  @Column()
  code!: string;

  /** Snapshot of the product name at pin time (for display). */
  @Column({ default: '' })
  name!: string;

  /** Live price for this session; falls back to catalog price when 0. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  livePrice!: number;

  @Column({ default: 0 })
  soldQty!: number;
}

export type LiveCommentStatus = 'NEW' | 'MATCHED' | 'CONVERTED' | 'IGNORED' | 'FAILED';

@Entity('live_comments')
@Index(['ownerId', 'sessionId', 'status'])
export class LiveComment extends OwnedEntity {
  @Index()
  @Column('uuid')
  sessionId!: string;

  /** Where the comment came from: manual console, an external bridge, etc. */
  @Column({ default: 'manual' })
  source!: string;

  @Column({ default: '' })
  buyerHandle!: string;

  /** Buyer phone for the payment request (optional at ingest, can be added
   *  at convert time). */
  @Column({ default: '' })
  buyerContact!: string;

  @Column({ type: 'text', default: '' })
  text!: string;

  @Column({ default: '' })
  matchedCode!: string;

  @Index()
  @Column('uuid', { nullable: true })
  matchedProductId?: string | null;

  @Column({ default: 1 })
  qty!: number;

  @Column({ default: 'NEW' })
  status!: LiveCommentStatus;

  @Index()
  @Column('uuid', { nullable: true })
  orderId?: string | null;

  @Column({ type: 'text', default: '' })
  note!: string;
}
