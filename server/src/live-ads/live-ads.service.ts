import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { PlatformEventsService } from '../platform/platform.service';
import { Creator } from '../creators/creator.entity';
import {
  AdDestination, LiveAdCampaign, LiveAdEvent, LiveAdSession, LiveAdSlot,
  LiveCreator, LiveHandleAlias,
} from './live-ads.entity';

const norm = (h: string) => h.trim().replace(/^@/, '').toLowerCase();
const token = (n = 24) => randomBytes(n).toString('hex');
function slotCode(): string {
  const d = randomBytes(3);
  return 'AD' + (((d[0] << 16) | (d[1] << 8) | d[2]) % 1_000_000).toString().padStart(6, '0');
}

/** How long a live session may go without an overlay heartbeat before it ends. */
const SESSION_STALE_MS = 90_000;

export type ResolveResult =
  | { live: boolean; mode: 'CREATOR_PAGE'; creator: { handle: string; name: string; avatar: string | null } }
  | { live: true; mode: 'SPONSOR_PAGE'; clickVisitId: string; sponsor: { name: string; offerText: string; couponCode: string | null; expiresAt: string }; ctaUrl: string; creator: { handle: string; name: string } }
  | { live: true; mode: 'DIRECT_REDIRECT'; clickVisitId: string; redirect: string };

@Injectable()
export class LiveAdsService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(LiveCreator) private readonly creatorsLive: Repository<LiveCreator>,
    @InjectRepository(LiveHandleAlias) private readonly aliases: Repository<LiveHandleAlias>,
    @InjectRepository(LiveAdSession) private readonly sessions: Repository<LiveAdSession>,
    @InjectRepository(AdDestination) private readonly destinations: Repository<AdDestination>,
    @InjectRepository(LiveAdCampaign) private readonly campaigns: Repository<LiveAdCampaign>,
    @InjectRepository(LiveAdSlot) private readonly slots: Repository<LiveAdSlot>,
    @InjectRepository(LiveAdEvent) private readonly events: Repository<LiveAdEvent>,
    @InjectRepository(Creator) private readonly creators: Repository<Creator>,
    private readonly platform: PlatformEventsService,
  ) {}

  // ── Creator identity (permanent link) ──────────────────────────────────────

  /** Create (or fetch) the permanent live identity for a creator. Idempotent. */
  async ensureIdentity(ownerId: string, creatorId: string, handle?: string) {
    const creator = await this.creators.findOne({ where: { id: creatorId, ownerId } });
    if (!creator) throw new NotFoundException('Creator not found');
    let live = await this.creatorsLive.findOne({ where: { creatorId } });
    if (live) return this.publicIdentity(live);
    const wanted = norm(handle || creator.handle || `creator-${creatorId.slice(0, 8)}`);
    if (await this.creatorsLive.findOne({ where: { handle: wanted } }))
      throw new BadRequestException('That handle is already taken on Kobe Live');
    live = await this.ds.transaction(async (tx) => {
      const row = await tx.getRepository(LiveCreator).save(tx.getRepository(LiveCreator).create({
        ownerId, creatorId, handle: wanted, displayName: creator.name, avatarUrl: creator.avatarUrl ?? null,
        overlayToken: token(), adsEnabled: true, defaultRoutingMode: 'SPONSOR_PAGE',
      }));
      await tx.getRepository(LiveHandleAlias).save(tx.getRepository(LiveHandleAlias).create({ handle: wanted, liveCreatorId: row.id }));
      return row;
    });
    return this.publicIdentity(live);
  }

  /** Rename the handle; the old handle stays as an alias so printed links live on. */
  async renameHandle(ownerId: string, creatorId: string, newHandle: string) {
    const live = await this.creatorsLive.findOne({ where: { creatorId, ownerId } });
    if (!live) throw new NotFoundException('Live identity not found');
    const wanted = norm(newHandle);
    if (!wanted) throw new BadRequestException('Handle is required');
    const clash = await this.creatorsLive.findOne({ where: { handle: wanted } });
    if (clash && clash.id !== live.id) throw new BadRequestException('That handle is already taken');
    await this.ds.transaction(async (tx) => {
      live.handle = wanted;
      await tx.getRepository(LiveCreator).save(live);
      if (!await tx.getRepository(LiveHandleAlias).findOne({ where: { handle: wanted } }))
        await tx.getRepository(LiveHandleAlias).save(tx.getRepository(LiveHandleAlias).create({ handle: wanted, liveCreatorId: live.id }));
    });
    return this.publicIdentity(live);
  }

  private publicIdentity(live: LiveCreator) {
    return {
      creatorId: live.creatorId,
      handle: live.handle,
      permanentUrl: `/live/@${live.handle}`,
      overlayUrl: `/live/overlay/${live.overlayToken}`,
      overlayToken: live.overlayToken,
      adsEnabled: live.adsEnabled,
      defaultRoutingMode: live.defaultRoutingMode,
    };
  }

  private async resolveLiveCreator(handle: string): Promise<LiveCreator | null> {
    const h = norm(handle);
    const alias = await this.aliases.findOne({ where: { handle: h } });
    if (alias) return this.creatorsLive.findOne({ where: { id: alias.liveCreatorId } });
    return this.creatorsLive.findOne({ where: { handle: h } });
  }

  // ── Session (Kobe-detected, not TikTok) ────────────────────────────────────

  private async byOverlayToken(overlayToken: string): Promise<LiveCreator> {
    const live = await this.creatorsLive.findOne({ where: { overlayToken } });
    if (!live) throw new NotFoundException('Unknown overlay token');
    return live;
  }

  /** Creator-authenticated manual session control (when not using the overlay). */
  async startManualSession(ownerId: string, creatorId: string) {
    const live = await this.creatorsLive.findOne({ where: { creatorId, ownerId } });
    if (!live) throw new NotFoundException('Live identity not found');
    return this.heartbeat(live.overlayToken, 'MANUAL');
  }
  async stopManualSession(ownerId: string, creatorId: string) {
    const live = await this.creatorsLive.findOne({ where: { creatorId, ownerId } });
    if (!live) throw new NotFoundException('Live identity not found');
    return this.endSession(live.overlayToken);
  }

  /** Overlay/broadcaster connects or heartbeats → keep (or open) a live session. */
  async heartbeat(overlayToken: string, source: 'OVERLAY' | 'BROADCASTER' | 'MANUAL' = 'OVERLAY') {
    const live = await this.byOverlayToken(overlayToken);
    const now = new Date();
    let session = await this.sessions.findOne({ where: { liveCreatorId: live.id, status: 'LIVE' }, order: { startedAt: 'DESC' } });
    if (session && now.getTime() - new Date(session.lastSeenAt).getTime() > SESSION_STALE_MS) {
      session.status = 'ENDED'; session.endedAt = now; await this.sessions.save(session); session = null;
    }
    if (!session) {
      session = await this.sessions.save(this.sessions.create({ liveCreatorId: live.id, status: 'LIVE', source, startedAt: now, lastSeenAt: now }));
      await this.platform.emit({ ownerId: live.ownerId, eventName: 'liveads.session_started', aggregateType: 'LiveAdSession', aggregateId: session.id, payload: { handle: live.handle } });
    } else {
      session.lastSeenAt = now; await this.sessions.save(session);
    }
    return { sessionId: session.id, status: session.status };
  }

  async endSession(overlayToken: string) {
    const live = await this.byOverlayToken(overlayToken);
    const session = await this.sessions.findOne({ where: { liveCreatorId: live.id, status: 'LIVE' } });
    if (!session) return { ended: false };
    session.status = 'ENDED'; session.endedAt = new Date();
    await this.slots.update({ sessionId: session.id, status: 'CTA_ACTIVE' }, { status: 'ENDED' });
    await this.sessions.save(session);
    await this.platform.emit({ ownerId: live.ownerId, eventName: 'liveads.session_ended', aggregateType: 'LiveAdSession', aggregateId: session.id, payload: {} });
    return { ended: true };
  }

  private async activeSession(liveCreatorId: string): Promise<LiveAdSession | null> {
    const s = await this.sessions.findOne({ where: { liveCreatorId, status: 'LIVE' }, order: { startedAt: 'DESC' } });
    if (!s) return null;
    if (Date.now() - new Date(s.lastSeenAt).getTime() > SESSION_STALE_MS) {
      s.status = 'ENDED'; s.endedAt = new Date(); await this.sessions.save(s); return null;
    }
    return s;
  }

  @Cron('30 * * * * *')
  async endStaleSessions() {
    const cutoff = new Date(Date.now() - SESSION_STALE_MS);
    const stale = await this.sessions.find({ where: { status: 'LIVE', lastSeenAt: LessThan(cutoff) } });
    for (const s of stale) {
      s.status = 'ENDED'; s.endedAt = new Date();
      await this.sessions.save(s);
      await this.slots.update({ sessionId: s.id, status: 'CTA_ACTIVE' }, { status: 'ENDED' });
    }
  }

  // ── Advertiser destinations (server-side, approved) ────────────────────────

  async createDestination(ownerId: string, rawUrl: string) {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new BadRequestException('Destination must be a valid URL'); }
    if (url.protocol !== 'https:') throw new BadRequestException('Destination must be HTTPS');
    return this.destinations.save(this.destinations.create({ ownerId, url: url.toString(), domain: url.hostname, status: 'ACTIVE' }));
  }

  async setDestinationStatus(ownerId: string, id: string, status: 'ACTIVE' | 'DISABLED') {
    const dest = await this.destinations.findOne({ where: { id, ownerId } });
    if (!dest) throw new NotFoundException('Destination not found');
    dest.status = status; return this.destinations.save(dest);
  }

  listDestinations(ownerId: string) { return this.destinations.find({ where: { ownerId }, order: { createdAt: 'DESC' } }); }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  async createCampaign(ownerId: string, dto: {
    title: string; sponsorName: string; destinationId: string; routingMode?: 'SPONSOR_PAGE' | 'DIRECT_REDIRECT';
    offerText?: string; couponCode?: string; creativeVideoUrl?: string;
    pricePerSlot?: number; costPerClick?: number; creatorSharePercent?: number; currency?: string;
  }) {
    const dest = await this.destinations.findOne({ where: { id: dto.destinationId, ownerId } });
    if (!dest) throw new NotFoundException('Destination not found (create an approved destination first)');
    return this.campaigns.save(this.campaigns.create({
      ownerId, title: dto.title, sponsorName: dto.sponsorName, destinationId: dest.id,
      routingMode: dto.routingMode ?? 'SPONSOR_PAGE', offerText: dto.offerText ?? '', couponCode: (dto.couponCode ?? '').toUpperCase(),
      creativeVideoUrl: dto.creativeVideoUrl ?? null, pricePerSlot: dto.pricePerSlot ?? 0, costPerClick: dto.costPerClick ?? 0,
      creatorSharePercent: dto.creatorSharePercent ?? 70, currency: dto.currency ?? 'TZS', status: 'DRAFT',
    }));
  }

  async submitCampaign(ownerId: string, id: string) {
    const c = await this.ownedCampaign(ownerId, id);
    if (c.status !== 'DRAFT' && c.status !== 'REJECTED') throw new BadRequestException(`Cannot submit a ${c.status} campaign`);
    c.status = 'PENDING_APPROVAL'; return this.campaigns.save(c);
  }

  /** Admin approval gate. */
  async reviewCampaign(id: string, approve: boolean, note?: string) {
    const c = await this.campaigns.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    c.status = approve ? 'APPROVED' : 'REJECTED';
    c.reviewNote = note ?? null;
    const saved = await this.campaigns.save(c);
    if (approve) await this.platform.emit({ ownerId: c.ownerId, eventName: 'liveads.campaign_approved', aggregateType: 'LiveAdCampaign', aggregateId: c.id, payload: {} });
    return saved;
  }

  async setCampaignStatus(ownerId: string, id: string, status: 'APPROVED' | 'PAUSED' | 'ENDED') {
    const c = await this.ownedCampaign(ownerId, id);
    c.status = status; return this.campaigns.save(c);
  }

  /** Admin kill-switch — stops a campaign everywhere without touching any bio link. */
  async emergencyStop(id: string) {
    const c = await this.campaigns.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    c.status = 'EMERGENCY_STOPPED';
    await this.slots.update({ campaignId: c.id, status: 'CTA_ACTIVE' }, { status: 'ENDED' });
    const saved = await this.campaigns.save(c);
    await this.platform.emit({ ownerId: c.ownerId, eventName: 'liveads.emergency_stopped', aggregateType: 'LiveAdCampaign', aggregateId: c.id, payload: {} });
    return saved;
  }

  listCampaigns(ownerId: string) {
    return this.campaigns.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  private async ownedCampaign(ownerId: string, id: string) {
    const c = await this.campaigns.findOne({ where: { id, ownerId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  // ── Slots (placement inside a session) ─────────────────────────────────────

  /**
   * Start a sponsorship placement. Separates the short creative-playback window
   * from the longer CTA-routing window so late clicks still reach the sponsor.
   */
  async startSlot(ownerId: string, creatorId: string, dto: { campaignId: string; playbackSeconds?: number; ctaSeconds?: number }) {
    const live = await this.creatorsLive.findOne({ where: { creatorId, ownerId } });
    if (!live) throw new NotFoundException('Live identity not found');
    if (!live.adsEnabled) throw new BadRequestException('This creator has ads disabled');
    const session = await this.activeSession(live.id);
    if (!session) throw new BadRequestException('Creator is not live — start a session first');
    const campaign = await this.campaigns.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'APPROVED') throw new BadRequestException('Campaign is not approved/active');
    const dest = await this.destinations.findOne({ where: { id: campaign.destinationId } });
    if (!dest || dest.status !== 'ACTIVE') throw new BadRequestException('Campaign destination is not active');

    const now = new Date();
    const playbackEnd = new Date(now.getTime() + (dto.playbackSeconds ?? 10) * 1000);
    const ctaEnd = new Date(now.getTime() + (dto.ctaSeconds ?? 900) * 1000); // default 15 min
    // Close any other active slot in this session — one current sponsor at a time.
    await this.slots.update({ sessionId: session.id, status: 'CTA_ACTIVE' }, { status: 'ENDED' });
    const slot = await this.slots.save(this.slots.create({
      sessionId: session.id, liveCreatorId: live.id, campaignId: campaign.id, code: slotCode(),
      status: 'CTA_ACTIVE', playbackStart: now, playbackEnd, ctaStart: now, ctaEnd,
    }));
    await this.platform.emit({ ownerId, eventName: 'liveads.slot_started', aggregateType: 'LiveAdSlot', aggregateId: slot.id, payload: { campaignId: campaign.id, sponsor: campaign.sponsorName } });
    return { slot, qr: `/live/a/${slot.code}` };
  }

  async endSlot(ownerId: string, slotId: string) {
    const slot = await this.slots.findOne({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('Slot not found');
    const live = await this.creatorsLive.findOne({ where: { id: slot.liveCreatorId, ownerId } });
    if (!live) throw new ForbiddenException('Not your slot');
    slot.status = 'ENDED'; return this.slots.save(slot);
  }

  /** What the OBS overlay should render right now for this creator. */
  async overlayState(overlayToken: string) {
    const live = await this.byOverlayToken(overlayToken);
    const session = await this.activeSession(live.id);
    if (!session) return { handle: live.handle, live: false, slot: null };
    const slot = await this.slots.findOne({ where: { sessionId: session.id, status: 'CTA_ACTIVE' }, order: { ctaStart: 'DESC' } });
    if (!slot || new Date(slot.ctaEnd).getTime() < Date.now()) return { handle: live.handle, live: true, slot: null };
    const campaign = await this.campaigns.findOne({ where: { id: slot.campaignId } });
    if (!campaign || campaign.status !== 'APPROVED') return { handle: live.handle, live: true, slot: null };
    return {
      handle: live.handle,
      live: true,
      slot: {
        slotId: slot.id,
        code: slot.code,
        sponsor: campaign.sponsorName,
        offerText: campaign.offerText,
        couponCode: campaign.couponCode || null,
        creativeVideoUrl: campaign.creativeVideoUrl ?? null,
        playbackEnd: new Date(slot.playbackEnd).toISOString(),
        ctaEnd: new Date(slot.ctaEnd).toISOString(),
      },
    };
  }

  /** Overlay reports a creative actually played on screen (proof-of-play). */
  async recordImpression(overlayToken: string, slotId: string) {
    const live = await this.byOverlayToken(overlayToken);
    const slot = await this.slots.findOne({ where: { id: slotId, liveCreatorId: live.id } });
    if (!slot) throw new NotFoundException('Slot not found for this creator');
    await this.events.save(this.events.create({ slotId: slot.id, liveCreatorId: live.id, campaignId: slot.campaignId, type: 'IMPRESSION', source: 'OVERLAY' }));
    return { ok: true };
  }

  // ── The redirect engine ────────────────────────────────────────────────────

  /** Resolve the permanent bio link → current sponsor state (or the creator page). */
  async resolveBio(handle: string): Promise<ResolveResult> {
    const live = await this.resolveLiveCreator(handle);
    if (!live) throw new NotFoundException('Unknown creator');
    return this.resolveForSlot(live, null, 'BIO');
  }

  /** Resolve a slot-exact QR → that specific sponsor (precise attribution). */
  async resolveQr(code: string): Promise<ResolveResult> {
    const slot = await this.slots.findOne({ where: { code } });
    if (!slot) throw new NotFoundException('Unknown code');
    const live = await this.creatorsLive.findOne({ where: { id: slot.liveCreatorId } });
    if (!live) throw new NotFoundException('Unknown creator');
    return this.resolveForSlot(live, slot, 'QR');
  }

  private creatorPage(live: LiveCreator, isLive: boolean): ResolveResult {
    return { live: isLive, mode: 'CREATOR_PAGE', creator: { handle: live.handle, name: live.displayName, avatar: live.avatarUrl ?? null } };
  }

  private async resolveForSlot(live: LiveCreator, fixedSlot: LiveAdSlot | null, source: 'BIO' | 'QR'): Promise<ResolveResult> {
    if (!live.adsEnabled) return this.creatorPage(live, false);
    const session = await this.activeSession(live.id);
    const isLive = !!session;

    // BIO uses the current CTA-window slot; QR pins to its own slot (exact attribution).
    const now = Date.now();
    let slot = fixedSlot;
    if (!slot) {
      if (!session) return this.creatorPage(live, false);
      slot = await this.slots.findOne({ where: { sessionId: session.id, status: 'CTA_ACTIVE' }, order: { ctaStart: 'DESC' } });
    }
    if (!slot || slot.status === 'ENDED' || new Date(slot.ctaEnd).getTime() < now) return this.creatorPage(live, isLive);

    const campaign = await this.campaigns.findOne({ where: { id: slot.campaignId } });
    const dest = campaign ? await this.destinations.findOne({ where: { id: campaign.destinationId } }) : null;
    // Safety: only an approved campaign with an active, server-side destination routes.
    if (!campaign || campaign.status !== 'APPROVED' || !dest || dest.status !== 'ACTIVE') return this.creatorPage(live, isLive);

    const clickVisitId = token(12);
    await this.events.save(this.events.create({ slotId: slot.id, liveCreatorId: live.id, campaignId: campaign.id, type: 'PROFILE_VISIT', source, clickVisitId, metadata: { destinationId: dest.id } }));

    if (campaign.routingMode === 'DIRECT_REDIRECT') {
      return { live: true, mode: 'DIRECT_REDIRECT', clickVisitId, redirect: `/api/live/go/${clickVisitId}` };
    }
    await this.events.save(this.events.create({ slotId: slot.id, liveCreatorId: live.id, campaignId: campaign.id, type: 'SPONSOR_VIEW', source, clickVisitId }));
    return {
      live: true, mode: 'SPONSOR_PAGE', clickVisitId,
      sponsor: { name: campaign.sponsorName, offerText: campaign.offerText, couponCode: campaign.couponCode || null, expiresAt: new Date(slot.ctaEnd).toISOString() },
      ctaUrl: `/api/live/go/${clickVisitId}`,
      creator: { handle: live.handle, name: live.displayName },
    };
  }

  /**
   * Click-through: re-validate at click time (so a disabled destination or
   * stopped campaign blocks it), record CTA_CLICK + ADVERTISER_VISIT, and return
   * the server-side approved URL. Advertisers can never inject a destination.
   */
  async clickThrough(clickVisitId: string): Promise<{ url: string } | null> {
    const visit = await this.events.findOne({ where: { clickVisitId, type: 'PROFILE_VISIT' }, order: { createdAt: 'DESC' } });
    if (!visit || !visit.campaignId || !visit.slotId) return null;
    const campaign = await this.campaigns.findOne({ where: { id: visit.campaignId } });
    if (!campaign || campaign.status !== 'APPROVED') return null;
    const dest = await this.destinations.findOne({ where: { id: campaign.destinationId } });
    if (!dest || dest.status !== 'ACTIVE') return null;
    const revenue = Number(campaign.costPerClick) || 0;
    await this.events.save([
      this.events.create({ slotId: visit.slotId, liveCreatorId: visit.liveCreatorId, campaignId: campaign.id, type: 'CTA_CLICK', source: visit.source, clickVisitId, revenue }),
      this.events.create({ slotId: visit.slotId, liveCreatorId: visit.liveCreatorId, campaignId: campaign.id, type: 'ADVERTISER_VISIT', source: visit.source, clickVisitId }),
    ]);
    await this.platform.emit({ ownerId: campaign.ownerId, eventName: 'liveads.cta_click', aggregateType: 'LiveAdCampaign', aggregateId: campaign.id, payload: { clickVisitId, revenue } });
    return { url: dest.url };
  }

  // ── Reporting ──────────────────────────────────────────────────────────────

  private count(rows: LiveAdEvent[], t: string) { return rows.filter((e) => e.type === t).length; }

  async creatorAdStats(creatorId: string) {
    const live = await this.creatorsLive.findOne({ where: { creatorId } });
    if (!live) throw new NotFoundException('Live identity not found');
    const [rows, slots] = await Promise.all([
      this.events.find({ where: { liveCreatorId: live.id } }),
      this.slots.find({ where: { liveCreatorId: live.id } }),
    ]);
    const campaignIds = [...new Set(slots.map((s) => s.campaignId))];
    const camps = campaignIds.length ? await this.campaigns.find({ where: campaignIds.map((id) => ({ id })) }) : [];
    const campMap = new Map(camps.map((c) => [c.id, c]));
    const clicks = rows.filter((e) => e.type === 'CTA_CLICK');
    // gross spend = fixed per-slot fee + per-click; creator earns their share.
    let grossSpend = 0; let creatorEarnings = 0;
    for (const s of slots) {
      const c = campMap.get(s.campaignId); if (!c) continue;
      const slotClicks = clicks.filter((e) => e.slotId === s.id).length;
      const spend = Number(c.pricePerSlot) + slotClicks * Number(c.costPerClick);
      grossSpend += spend;
      creatorEarnings += spend * (Number(c.creatorSharePercent) / 100);
    }
    return {
      handle: live.handle,
      slots: slots.length,
      impressions: this.count(rows, 'IMPRESSION'),
      profileVisits: this.count(rows, 'PROFILE_VISIT'),
      sponsorViews: this.count(rows, 'SPONSOR_VIEW'),
      ctaClicks: clicks.length,
      advertiserVisits: this.count(rows, 'ADVERTISER_VISIT'),
      conversions: this.count(rows, 'CONVERSION'),
      grossAdSpend: Math.round(grossSpend * 10000) / 10000,
      creatorEarnings: Math.round(creatorEarnings * 10000) / 10000,
      currency: camps[0]?.currency || 'TZS',
    };
  }

  async campaignAdStats(ownerId: string, id: string) {
    const c = await this.ownedCampaign(ownerId, id);
    const rows = await this.events.find({ where: { campaignId: c.id } });
    const clicks = this.count(rows, 'CTA_CLICK');
    const impressions = this.count(rows, 'IMPRESSION');
    return {
      campaignId: c.id, sponsor: c.sponsorName, status: c.status,
      impressions, profileVisits: this.count(rows, 'PROFILE_VISIT'),
      sponsorViews: this.count(rows, 'SPONSOR_VIEW'), ctaClicks: clicks,
      advertiserVisits: this.count(rows, 'ADVERTISER_VISIT'), conversions: this.count(rows, 'CONVERSION'),
      clickThroughRate: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
    };
  }
}
