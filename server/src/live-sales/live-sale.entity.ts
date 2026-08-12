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
export type LiveKind = 'live' | 'post';

@Entity('live_sessions')
@Index(['ownerId', 'status'])
export class LiveSession extends OwnedEntity {
  @Column({ default: 'Live Sale' })
  title!: string;

  @Column({ default: 'other' })
  platform!: LivePlatform;

  @Column({ default: 'LIVE' })
  status!: LiveStatus;

  /** 'live' = a livestream session; 'post' = an ad/post campaign whose comments
   *  are polled (e.g. via Apify) rather than streamed. Post campaigns aren't
   *  gated by LIVE status. */
  @Column({ default: 'live' })
  kind!: LiveKind;

  /** For a 'post' campaign: the ad/post URL whose comments we poll. */
  @Column({ default: '' })
  postUrl!: string;

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

  /** The "NOW SHOWING" product on the live catalog. One per session. */
  @Column({ default: false })
  isFeatured!: boolean;

  @Column({ default: 0 })
  soldQty!: number;
}

export type LiveCommentStatus = 'NEW' | 'MATCHED' | 'RESERVED' | 'CONVERTED' | 'IGNORED' | 'FAILED' | 'EXPIRED';

@Entity('live_comments')
@Index(['ownerId', 'sessionId', 'status'])
export class LiveComment extends OwnedEntity {
  @Index()
  @Column('uuid')
  sessionId!: string;

  /** Where the comment came from: manual console, an external bridge, etc. */
  @Column({ default: 'manual' })
  source!: string;

  /** Platform's own comment id, used to de-duplicate polled (Apify) comments. */
  @Index()
  @Column({ default: '' })
  externalId!: string;

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

  /** Public checkout token — the buyer opens /live/pay/{token} to pay. */
  @Index()
  @Column({ default: '' })
  checkoutToken!: string;

  /** Short human code the moderator reads out (e.g. "K7Q4") so the buyer can
   *  pull up their reservation on the catalog page. */
  @Index()
  @Column({ default: '' })
  reservationCode!: string;

  /** RESERVED expiry — stock is held until this time, then auto-released. */
  @Column({ type: 'timestamptz', nullable: true })
  reservedUntil?: Date | null;

  @Column({ type: 'text', default: '' })
  note!: string;
}
