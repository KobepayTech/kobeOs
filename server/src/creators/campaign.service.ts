import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Campaign, CreatorOffer } from './campaign.entity';
import { Creator } from './creator.entity';
import {
  CreateCampaignDto,
  RespondOfferDto,
  SendOfferDto,
  SubmitProofDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Creator)  private readonly creators: Repository<Creator>,
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
    if (!['open', 'in_progress'].includes(campaign.status)) {
      throw new BadRequestException('Campaign is not accepting offers');
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

    const offerIdx = campaign.offers.findIndex(
      (o) => o.id === offerId && o.creatorId === creatorUserId,
    );
    if (offerIdx === -1) throw new NotFoundException('Offer not found');

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
    return this.campaigns.save(campaign);
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

    const offerIdx = campaign.offers.findIndex(
      (o) => o.id === offerId && o.creatorId === creatorUserId,
    );
    if (offerIdx === -1) throw new NotFoundException('Offer not found');

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
