import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Campaign, CreatorOffer } from './campaign.entity';
import { Creator } from './creator.entity';
import { Wallet } from '../payments/payments.entity';
import { ConfigService } from '@nestjs/config';
import {
  AttachMediaDto,
  CreateCampaignDto,
  PromoteProductDto,
  PublishTikTokDto,
  RespondOfferDto,
  SendOfferDto,
  SubmitProofDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';
import { EscrowService } from './escrow.service';
import { TikTokService } from '../social-scheduler/tiktok.service';
import { PlatformEventsService } from '../platform/platform.service';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Creator)  private readonly creators: Repository<Creator>,
    @InjectRepository(Wallet)   private readonly wallets: Repository<Wallet>,
    @Inject(forwardRef(() => EscrowService)) private readonly escrowSvc: EscrowService,
    private readonly tiktok: TikTokService,
    private readonly config: ConfigService,
    private readonly events: PlatformEventsService,
  ) {}

  // ── Advertiser CRUD ─────────────────────────────────────────────────────────

  list(advertiserId: string) {
    return this.campaigns.find({
      where: { ownerId: advertiserId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(advertiserId: string, id: string) {
    const c = await this.campaigns.findOne({ where: { id, ownerId: advertiserId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  create(advertiserId: string, dto: CreateCampaignDto) {
    const campaign = this.campaigns.create({
      ownerId: advertiserId,
      name: dto.name,
      description: dto.description ?? '',
      brand: dto.brand ?? '',
      niche: dto.niche ?? '',
      budgetTzs: dto.budgetTzs,
      platformFeePercent: dto.platformFeePercent ?? 10,
      requirements: dto.requirements ?? [],
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      status: 'draft',
      offers: [],
    });
    return this.campaigns.save(campaign);
  }

  /**
   * "Promote With Creators": spawn a campaign from a real KobeOS product. The
   * product is referenced by id (never recreated in the marketplace), and the
   * campaign opens for creator applications immediately.
   */
  createFromProduct(advertiserId: string, dto: PromoteProductDto) {
    const campaign = this.campaigns.create({
      ownerId: advertiserId,
      name: dto.name?.trim() || `Promote ${dto.productName}`,
      description: '',
      brand: '',
      niche: dto.niche ?? '',
      budgetTzs: dto.budgetTzs ?? 0,
      platformFeePercent: dto.platformFeePercent ?? 10,
      requirements: dto.requirements ?? [],
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      status: 'open',
      offers: [],
      productId: dto.productId,
      productName: dto.productName,
      productPrice: dto.productPrice,
      commissionPercent: dto.commissionPercent,
      destination: dto.destination ?? 'jumla',
      destinationUrl: dto.destinationUrl ?? `/jumla?product=${dto.productId}`,
    });
    return this.campaigns.save(campaign);
  }

  async update(advertiserId: string, id: string, dto: UpdateCampaignDto) {
    const campaign = await this.get(advertiserId, id);
    if (campaign.status !== 'draft' && campaign.status !== 'open') {
      throw new BadRequestException('Cannot edit a campaign that is in progress or completed');
    }
    Object.assign(campaign, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.brand !== undefined && { brand: dto.brand }),
      ...(dto.niche !== undefined && { niche: dto.niche }),
      ...(dto.budgetTzs !== undefined && { budgetTzs: dto.budgetTzs }),
      ...(dto.requirements !== undefined && { requirements: dto.requirements }),
      ...(dto.endsAt !== undefined && { endsAt: new Date(dto.endsAt) }),
    });
    return this.campaigns.save(campaign);
  }

  async publish(advertiserId: string, id: string) {
    const campaign = await this.get(advertiserId, id);
    if (campaign.status !== 'draft') throw new BadRequestException('Campaign is not in draft');
    campaign.status = 'open';
    return this.campaigns.save(campaign);
  }

  async cancel(advertiserId: string, id: string) {
    const campaign = await this.get(advertiserId, id);
    if (['completed', 'cancelled'].includes(campaign.status)) {
      throw new BadRequestException('Campaign is already finished');
    }
    campaign.status = 'cancelled';
    return this.campaigns.save(campaign);
  }

  // ── Offer management ────────────────────────────────────────────────────────

  async sendOffer(advertiserId: string, campaignId: string, dto: SendOfferDto) {
    const campaign = await this.get(advertiserId, campaignId);
    if (campaign.status === 'draft') {
      throw new BadRequestException('Campaign must be published before sending offers. Use POST /campaigns/:id/publish first.');
    }
    if (!['open', 'in_progress'].includes(campaign.status)) {
      throw new BadRequestException(`Campaign is not accepting offers (status: ${campaign.status})`);
    }

    const creator = await this.creators.findOne({ where: { id: dto.creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    // Prevent duplicate pending offers to the same creator
    const existing = campaign.offers.find(
      (o) => o.creatorId === dto.creatorId && ['pending', 'accepted', 'active'].includes(o.status),
    );
    if (existing) throw new BadRequestException('An active offer already exists for this creator');

    const offer: CreatorOffer = {
      id: randomUUID(),
      creatorId: creator.id,
      creatorName: creator.name,
      creatorHandle: creator.handle,
      amountTzs: dto.amountTzs,
      status: 'pending',
      proofUrls: [],
      sentAt: new Date().toISOString(),
      notes: dto.notes,
    };

    campaign.offers = [...campaign.offers, offer];
    if (campaign.status === 'open') campaign.status = 'in_progress';
    const saved = await this.campaigns.save(campaign);
    this.logger.log(`Offer sent to ${creator.handle} for campaign ${campaign.name}`);
    return saved;
  }

  /**
   * Creator responds to an offer.
   * creatorId is the authenticated user's ID — we match by creatorId on the offer.
   */
  async respondToOffer(
    creatorUserId: string,
    campaignId: string,
    offerId: string,
    dto: RespondOfferDto,
  ) {
    // Find campaign by ID (creator doesn't own it, so no ownerId filter)
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const offerIdx = await this.offerIndexForCreator(campaign, offerId, creatorUserId);

    const offer = campaign.offers[offerIdx];
    if (offer.status !== 'pending' && offer.status !== 'negotiating') {
      throw new BadRequestException('Offer cannot be responded to in its current state');
    }

    offer.status = dto.response === 'accepted' ? 'active'
      : dto.response === 'declined' ? 'declined'
      : 'negotiating';
    offer.respondedAt = new Date().toISOString();
    if (dto.notes) offer.notes = dto.notes;
    if (dto.response === 'negotiating' && dto.counterAmountTzs) {
      offer.amountTzs = dto.counterAmountTzs;
    }

    campaign.offers = campaign.offers.map((o, i) => (i === offerIdx ? offer : o));
    const saved = await this.campaigns.save(campaign);

    // Auto-hold escrow when creator accepts — debit advertiser's first active wallet
    if (dto.response === 'accepted') {
      const advertiserWallet = await this.wallets.findOne({
        where: { ownerId: campaign.ownerId, active: true },
        order: { createdAt: 'ASC' },
      });
      if (advertiserWallet) {
        try {
          await this.escrowSvc.hold({
            advertiserId: campaign.ownerId,
            creatorId: creatorUserId,
            campaignId: campaign.id,
            offerId: offer.id,
            amountTzs: offer.amountTzs,
            platformFeePercent: campaign.platformFeePercent,
            advertiserWalletId: advertiserWallet.id,
          });
        } catch (err) {
          // Log but don't fail the acceptance — advertiser can lock funds manually
          this.logger.warn(
            `Auto-hold failed for offer ${offer.id}: ${(err as Error).message}. ` +
            `Advertiser can lock funds via POST /campaigns/${campaign.id}/lock-funds`,
          );
        }
      } else {
        this.logger.warn(
          `No active wallet for advertiser ${campaign.ownerId} — ` +
          `escrow not held for offer ${offer.id}`,
        );
      }
    }

    return saved;
  }

  /** Creator submits proof of content (URLs to posts/screenshots) */
  async submitProof(
    creatorUserId: string,
    campaignId: string,
    offerId: string,
    dto: SubmitProofDto,
  ) {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const offerIdx = await this.offerIndexForCreator(campaign, offerId, creatorUserId);

    const offer = campaign.offers[offerIdx];
    if (offer.status !== 'active') {
      throw new BadRequestException('Offer must be active before submitting proof');
    }

    offer.proofUrls = dto.proofUrls;
    offer.status = 'submitted';
    campaign.offers = campaign.offers.map((o, i) => (i === offerIdx ? offer : o));
    campaign.status = 'verifying';
    return this.campaigns.save(campaign);
  }

  // ── Content deliverables (Phase 3: publish → verify → monitor) ─────────────

  /**
   * Resolve an offer index and authorize the caller as its creator. An offer's
   * `creatorId` is a Creator entity id; the caller proves they are that creator
   * by owning the Creator profile (ownerId === caller's user id). Shared by
   * respond/proof/deliverable actions so they authorize identically.
   */
  private async offerIndexForCreator(campaign: Campaign, offerId: string, callerUserId: string): Promise<number> {
    const idx = campaign.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new NotFoundException('Offer not found');
    const creator = await this.creators.findOne({ where: { id: campaign.offers[idx].creatorId, ownerId: callerUserId } });
    if (!creator) throw new ForbiddenException('Only the assigned creator can act on this offer');
    return idx;
  }

  private async locateCreatorOffer(campaign: Campaign, offerId: string, creatorUserId: string) {
    const idx = await this.offerIndexForCreator(campaign, offerId, creatorUserId);
    const offer = campaign.offers[idx];
    if (offer.status === 'declined' || offer.status === 'pending') {
      throw new BadRequestException('Accept the offer before adding content');
    }
    return { idx, offer };
  }

  private saveOffer(campaign: Campaign, idx: number, offer: CreatorOffer) {
    campaign.offers = campaign.offers.map((o, i) => (i === idx ? offer : o));
    return this.campaigns.save(campaign);
  }

  /**
   * Attach an already-published post/video the creator selected from their own
   * account (spec §193) — no KobeOS publishing needed. Marks the deliverable
   * PUBLISHED and sets the contractual live-until window.
   */
  async attachExistingMedia(creatorUserId: string, campaignId: string, offerId: string, dto: AttachMediaDto) {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const { idx, offer } = await this.locateCreatorOffer(campaign, offerId, creatorUserId);
    offer.deliverablePlatform = dto.platform;
    offer.publishedMediaId = dto.mediaId;
    offer.publishedUrl = dto.url ?? '';
    offer.publishedAt = new Date().toISOString();
    offer.publishStatus = 'PUBLISHED';
    if (dto.liveDays && dto.liveDays > 0) offer.liveUntil = new Date(Date.now() + dto.liveDays * 86_400_000).toISOString();
    const saved = await this.saveOffer(campaign, idx, offer);
    await this.events.emit({ ownerId: campaign.ownerId, eventName: 'creator.content_published', aggregateType: 'Campaign', aggregateId: campaign.id, payload: { offerId, platform: dto.platform, mediaId: dto.mediaId, source: 'existing' } });
    return saved;
  }

  /**
   * Publish new campaign content to the creator's connected TikTok via the
   * Content Posting API. Gated behind CREATOR_TIKTOK_POSTING_ENABLED because
   * live posting depends on TikTok product approval/audit.
   */
  async publishTikTokContent(creatorUserId: string, campaignId: string, offerId: string, dto: PublishTikTokDto) {
    if (this.config.get<string>('CREATOR_TIKTOK_POSTING_ENABLED') !== 'true') {
      throw new BadRequestException('TikTok posting is not enabled for this deployment yet. Attach an existing post instead.');
    }
    if (!dto.mediaUrls?.length) throw new BadRequestException('Provide at least one video or photo URL');
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const { idx, offer } = await this.locateCreatorOffer(campaign, offerId, creatorUserId);
    const mediaId = await this.tiktok.publishForOwner(creatorUserId, { mediaUrls: dto.mediaUrls, caption: dto.caption });
    offer.deliverablePlatform = 'tiktok';
    offer.publishedMediaId = mediaId;
    offer.publishedAt = new Date().toISOString();
    offer.publishStatus = 'PUBLISHED';
    if (dto.liveDays && dto.liveDays > 0) offer.liveUntil = new Date(Date.now() + dto.liveDays * 86_400_000).toISOString();
    const saved = await this.saveOffer(campaign, idx, offer);
    await this.events.emit({ ownerId: campaign.ownerId, eventName: 'creator.content_published', aggregateType: 'Campaign', aggregateId: campaign.id, payload: { offerId, platform: 'tiktok', mediaId, source: 'kobeos' } });
    return saved;
  }

  /** Advertiser/system marks a published deliverable as API-verified (§194). */
  async verifyDeliverable(ownerId: string, campaignId: string, offerId: string) {
    const campaign = await this.get(ownerId, campaignId);
    const idx = campaign.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new NotFoundException('Offer not found');
    const offer = campaign.offers[idx];
    if (!offer.publishedMediaId) throw new BadRequestException('No published media to verify');
    offer.publishStatus = 'PUBLISHED_VERIFIED';
    offer.deliverableVerifiedAt = new Date().toISOString();
    const saved = await this.saveOffer(campaign, idx, offer);
    await this.events.emit({ ownerId, eventName: 'creator.content_verified', aggregateType: 'Campaign', aggregateId: campaign.id, payload: { offerId, mediaId: offer.publishedMediaId } });
    return saved;
  }

  /**
   * Mark a deliverable removed. If the post is taken down before its contractual
   * live-until, that is a deliverable breach (§195).
   */
  async markDeliverableRemoved(ownerId: string, campaignId: string, offerId: string) {
    const campaign = await this.get(ownerId, campaignId);
    const idx = campaign.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) throw new NotFoundException('Offer not found');
    const offer = campaign.offers[idx];
    const breach = !!offer.liveUntil && Date.now() < new Date(offer.liveUntil).getTime();
    offer.publishStatus = 'REMOVED';
    const saved = await this.saveOffer(campaign, idx, offer);
    await this.events.emit({ ownerId, eventName: 'creator.content_removed', aggregateType: 'Campaign', aggregateId: campaign.id, payload: { offerId, breach } });
    return { campaign: saved, breach };
  }

  // ── Manual escrow lock ──────────────────────────────────────────────────────

  /**
   * Advertiser manually locks funds for a specific accepted offer.
   * Used when auto-hold failed (e.g. insufficient balance at acceptance time)
   * or when the advertiser wants to pre-fund before the creator responds.
   */
  async lockFunds(advertiserId: string, campaignId: string, offerId: string): Promise<CreatorOffer> {
    const campaign = await this.get(advertiserId, campaignId);
    const offer = campaign.offers.find((o) => o.id === offerId);
    if (!offer) throw new NotFoundException('Offer not found');

    if (!['pending', 'active'].includes(offer.status)) {
      throw new BadRequestException(
        `Cannot lock funds for an offer with status "${offer.status}"`,
      );
    }

    // Check escrow doesn't already exist
    const existing = await this.escrowSvc.findByCampaign(campaignId);
    if (existing.some((e) => e.offerId === offerId && e.status === 'held')) {
      throw new BadRequestException('Funds are already locked for this offer');
    }

    const advertiserWallet = await this.wallets.findOne({
      where: { ownerId: advertiserId, active: true },
      order: { createdAt: 'ASC' },
    });
    if (!advertiserWallet) throw new NotFoundException('No active wallet found for your account');

    await this.escrowSvc.hold({
      advertiserId,
      creatorId: offer.creatorId,
      campaignId,
      offerId,
      amountTzs: offer.amountTzs,
      platformFeePercent: campaign.platformFeePercent,
      advertiserWalletId: advertiserWallet.id,
    });

    this.logger.log(`Funds manually locked for offer ${offerId} by advertiser ${advertiserId}`);
    return offer;
  }

  // ── Public discovery (for marketplace) ─────────────────────────────────────

  listOpen() {
    return this.campaigns.find({
      where: { status: 'open' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // ── Internal: mark offer verified + update campaign status ─────────────────

  async markOfferVerified(
    campaignId: string,
    offerId: string,
    verifiedViews: number,
    verifiedLikes: number,
  ) {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) return;

    const offerIdx = campaign.offers.findIndex((o) => o.id === offerId);
    if (offerIdx === -1) return;

    campaign.offers[offerIdx] = {
      ...campaign.offers[offerIdx],
      status: 'verified',
      verifiedViews,
      verifiedLikes,
      verifiedAt: new Date().toISOString(),
    };

    // If all submitted offers are verified, move campaign to completed
    const allDone = campaign.offers
      .filter((o) => ['submitted', 'verified', 'paid', 'failed'].includes(o.status))
      .every((o) => ['verified', 'paid', 'failed'].includes(o.status));

    if (allDone) campaign.status = 'completed';

    await this.campaigns.save(campaign);
    this.logger.log(`Offer ${offerId} verified: ${verifiedViews} views`);
  }

  async markOfferPaid(campaignId: string, offerId: string) {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId } });
    if (!campaign) return;
    const offerIdx = campaign.offers.findIndex((o) => o.id === offerId);
    if (offerIdx === -1) return;
    campaign.offers[offerIdx] = {
      ...campaign.offers[offerIdx],
      status: 'paid',
      paidAt: new Date().toISOString(),
    };
    await this.campaigns.save(campaign);
  }
}
