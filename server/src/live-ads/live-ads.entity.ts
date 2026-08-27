import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Kobe Live Ads — permanent-link performance-ad network for live streamers.
 *
 * The creator enters ONE permanent URL (kobe.live/@handle) into their TikTok
 * profile, once. The URL never changes; the STATE behind it changes. When the
 * creator is live and a campaign is in its CTA window, the link opens the
 * current sponsor's page; otherwise it opens the creator's own live page.
 *
 * Kobe owns the whole attribution layer (impression → profile visit → sponsor
 * view → CTA click → advertiser visit → conversion) — TikTok never has to tell
 * us who clicked. Sessions are Kobe-detected (overlay/broadcaster), not from a
 * TikTok LIVE API (no such public scope exists).
 */

// ── Creator identity (permanent link) ────────────────────────────────────────

@Entity('live_creators')
export class LiveCreator extends OwnedEntity {
  /** The KobeOS Creator entity id this live identity belongs to. */
  @Index({ unique: true })
  @Column('uuid')
  creatorId!: string;

  /** Current TikTok-style handle (without @). The public URL is /live/@<handle>. */
  @Index()
  @Column()
  handle!: string;

  @Column({ default: '' })
  displayName!: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl?: string | null;

  /** Secret token the OBS overlay / Kobe Broadcaster uses to open a session. */
  @Index({ unique: true })
  @Column()
  overlayToken!: string;

  @Column({ default: true })
  adsEnabled!: boolean;

  /** Default routing when a sponsor is active. */
  @Column({ default: 'SPONSOR_PAGE' })
  defaultRoutingMode!: 'SPONSOR_PAGE' | 'DIRECT_REDIRECT';
}

/**
 * Old handle → live creator. If the creator renames on TikTok, the previous
 * kobe.live/@old link keeps resolving to the same creator (printed links never
 * die). Internal identity is the id, never the username.
 */
@Entity('live_handle_aliases')
export class LiveHandleAlias extends BaseEntity {
  @Index({ unique: true })
  @Column()
  handle!: string;

  @Index()
  @Column('uuid')
  liveCreatorId!: string;
}

// ── Session (Kobe-detected live state) ───────────────────────────────────────

@Entity('live_ad_sessions')
export class LiveAdSession extends BaseEntity {
  @Index()
  @Column('uuid')
  liveCreatorId!: string;

  @Index()
  @Column({ default: 'LIVE' })
  status!: 'LIVE' | 'ENDED';

  /** How Kobe learned the creator is broadcasting. */
  @Column({ default: 'OVERLAY' })
  source!: 'OVERLAY' | 'MANUAL' | 'BROADCASTER';

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  /** Last overlay heartbeat; a stale session is auto-ended. */
  @Index()
  @Column({ type: 'timestamptz' })
  lastSeenAt!: Date;
}

// ── Advertiser destination (server-side, approved) ───────────────────────────

/**
 * The only URL a campaign can send traffic to. Stored server-side and verified;
 * advertisers can NEVER supply a destination at click time (no open redirect).
 * Disabling a destination instantly kills every campaign pointing at it without
 * touching the creator's bio.
 */
@Entity('live_ad_destinations')
export class AdDestination extends OwnedEntity {
  @Column({ type: 'text' })
  url!: string;

  @Column()
  domain!: string;

  @Index()
  @Column({ default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';
}

// ── Campaign ─────────────────────────────────────────────────────────────────

export type LiveAdCampaignStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'PAUSED' | 'ENDED' | 'EMERGENCY_STOPPED';

@Entity('live_ad_campaigns')
export class LiveAdCampaign extends OwnedEntity {
  /** ownerId = advertiser. */
  @Column()
  title!: string;

  @Column()
  sponsorName!: string;

  @Index()
  @Column('uuid')
  destinationId!: string;

  @Index()
  @Column({ default: 'DRAFT' })
  status!: LiveAdCampaignStatus;

  @Column({ default: 'SPONSOR_PAGE' })
  routingMode!: 'SPONSOR_PAGE' | 'DIRECT_REDIRECT';

  /**
   * How the ad renders on the creator's overlay / Kobe app. All are clearly
   * "Sponsored" — a notification FORMAT, never a spoof of a real app.
   */
  @Column({ default: 'CARD' })
  creativeFormat!: 'CARD' | 'BANNER' | 'FULLSCREEN' | 'VIDEO';

  // Sponsor-page creative
  @Column({ type: 'text', default: '' })
  offerText!: string;

  @Column({ default: '' })
  couponCode!: string;

  @Column({ type: 'varchar', nullable: true })
  creativeVideoUrl?: string | null;

  // Pricing: a fixed sponsorship fee per slot + optional cost-per-click.
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  pricePerSlot!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  costPerClick!: number;

  /** Creator revenue share (%) of ad spend this campaign generates. */
  @Column({ type: 'float', default: 70 })
  creatorSharePercent!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'varchar', nullable: true })
  reviewNote?: string | null;
}

// ── Slot (a placement inside a session) ──────────────────────────────────────

/**
 * One sponsorship placement. Two independent windows:
 *  - creativePlayback: when the video overlay is on screen (e.g. 10s)
 *  - ctaRouting: how long the permanent link routes to this sponsor (e.g. 15min)
 * so someone who saw the 10s creative still lands on the right sponsor minutes
 * later.
 */
@Entity('live_ad_slots')
export class LiveAdSlot extends BaseEntity {
  @Index()
  @Column('uuid')
  sessionId!: string;

  @Index()
  @Column('uuid')
  liveCreatorId!: string;

  @Index()
  @Column('uuid')
  campaignId!: string;

  /** Short code for the slot-specific QR (kobe.live/a/<code>) → exact attribution. */
  @Index({ unique: true })
  @Column()
  code!: string;

  @Index()
  @Column({ default: 'CTA_ACTIVE' })
  status!: 'PLAYING' | 'CTA_ACTIVE' | 'ENDED';

  @Column({ type: 'timestamptz' })
  playbackStart!: Date;

  @Column({ type: 'timestamptz' })
  playbackEnd!: Date;

  @Column({ type: 'timestamptz' })
  ctaStart!: Date;

  @Index()
  @Column({ type: 'timestamptz' })
  ctaEnd!: Date;
}

// ── Attribution + proof-of-play events ───────────────────────────────────────

export type LiveAdEventType =
  | 'IMPRESSION'        // creative played on the overlay (proof-of-play)
  | 'PROFILE_VISIT'     // someone opened the permanent link
  | 'SPONSOR_VIEW'      // the Kobe sponsor page rendered
  | 'CTA_CLICK'         // they tapped through
  | 'ADVERTISER_VISIT'  // redirected to the approved destination
  | 'CONVERSION';       // a downstream sale/lead was attributed

@Entity('live_ad_events')
export class LiveAdEvent extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', nullable: true })
  slotId?: string | null;

  @Index()
  @Column('uuid')
  liveCreatorId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  campaignId?: string | null;

  @Index()
  @Column()
  type!: LiveAdEventType;

  /** BIO = dynamic current-sponsor link; QR = slot-exact link. */
  @Column({ default: 'BIO' })
  source!: 'BIO' | 'QR' | 'OVERLAY';

  /** Per-visitor id issued when the link is first opened, threading the funnel. */
  @Index()
  @Column({ default: '' })
  clickVisitId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  revenue!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}

/**
 * An automatic ad-delivery schedule for a creator: while they're live, Kobe
 * rotates through these approved campaigns, starting a new sponsor slot every
 * `everySeconds`. This is what makes the app "listen for a livestream and start
 * delivering ads" with zero per-stream effort.
 */
@Entity('live_ad_rotations')
export class LiveAdRotation extends OwnedEntity {
  @Index({ unique: true })
  @Column('uuid')
  liveCreatorId!: string;

  @Column({ type: 'jsonb', default: '[]' })
  campaignIds!: string[];

  @Column({ type: 'int', default: 300 })
  everySeconds!: number;

  @Column({ type: 'int', default: 10 })
  playbackSeconds!: number;

  @Column({ type: 'int', default: 900 })
  ctaSeconds!: number;

  @Column({ default: true })
  active!: boolean;

  /** Round-robin cursor + when the last slot was auto-started. */
  @Column({ type: 'int', default: 0 })
  cursor!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastStartedAt?: Date | null;
}

export const LIVE_ADS_ENTITIES = [
  LiveCreator, LiveHandleAlias, LiveAdSession,
  AdDestination, LiveAdCampaign, LiveAdSlot, LiveAdEvent, LiveAdRotation,
];
