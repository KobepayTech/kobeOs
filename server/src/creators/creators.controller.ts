import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { IsEnum, IsString, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { CreatorsService } from './creators.service';
import { CampaignService } from './campaign.service';
import { EscrowService } from './escrow.service';
import { MetricsEngineService } from './metrics-engine.service';
import { CreatorSubscriptionService } from './creator-subscription.service';
import { CreatorTier } from './creator-subscription.entity';
import { CreateCreatorDto, SearchCreatorsDto, SyncCreatorDto, UpdateCreatorDto } from './dto/creator.dto';
import {
  CreateCampaignDto, RespondOfferDto, SendOfferDto,
  SubmitProofDto, UpdateCampaignDto,
} from './dto/campaign.dto';
import { AddReviewDto, CampaignAnalyticsDto, SetPackagesDto } from './dto/marketplace.dto';

class UpgradeSubscriptionDto {
  @IsEnum(['basic', 'premium', 'elite']) tier!: CreatorTier;
  /** Creator's mobile money phone number e.g. 0712345678 or 255712345678 */
  @IsString() phone!: string;
  @IsString() name!: string;
  @IsString() email!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('creators')
export class CreatorsController {
  constructor(
    private readonly svc: CreatorsService,
    private readonly campaigns: CampaignService,
    private readonly escrow: EscrowService,
    private readonly metrics: MetricsEngineService,
    private readonly subscriptions: CreatorSubscriptionService,
  ) {}

  @Get()
  list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }

  @Get('search')
  @Public()
  search(@Query() dto: SearchCreatorsDto) { return this.svc.search(dto); }

  @Get('marketplace')
  @Public()
  marketplace(@Query() dto: SearchCreatorsDto) { return this.svc.search(dto); }

  // ── Reviews ─────────────────────────────────────────────────────────────────

  /** Add a review after a completed campaign */
  @Post('reviews')
  addReview(@CurrentUser('id') uid: string, @Body() dto: AddReviewDto) {
    return this.svc.addReview(uid, dto);
  }

  @Get('reviews')
  getReviews(@Query('creatorId') creatorId: string) {
    return this.svc.getReviews(creatorId);
  }

  // ── Packages ────────────────────────────────────────────────────────────────

  /** Set service packages for a creator */
  @Post('packages')
  setPackages(@CurrentUser('id') uid: string, @Body() dto: SetPackagesDto) {
    return this.svc.setPackages(uid, dto);
  }

  @Get('packages/:creatorId')
  getPackages(@Param('creatorId') creatorId: string) {
    return this.svc.getPackages(creatorId);
  }

  // ── Campaigns ───────────────────────────────────────────────────────────────

  @Get('campaigns/open')
  @Public()
  openCampaigns() { return this.campaigns.listOpen(); }

  @Get('campaigns/mine')
  myCampaigns(@CurrentUser('id') uid: string) { return this.campaigns.list(uid); }

  @Post('campaigns')
  createCampaign(@CurrentUser('id') uid: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(uid, dto);
  }

  @Patch('campaigns/:id')
  updateCampaign(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(uid, id, dto);
  }

  @Post('campaigns/:id/publish')
  publishCampaign(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.campaigns.publish(uid, id);
  }

  @Post('campaigns/:id/cancel')
  cancelCampaign(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.campaigns.cancel(uid, id);
  }

  @Post('campaigns/:id/offers')
  sendOffer(@CurrentUser('id') uid: string, @Param('id') campaignId: string, @Body() dto: SendOfferDto) {
    return this.campaigns.sendOffer(uid, campaignId, dto);
  }

  @Post('campaigns/:campaignId/offers/:offerId/respond')
  respondOffer(
    @CurrentUser('id') uid: string,
    @Param('campaignId') campaignId: string,
    @Param('offerId') offerId: string,
    @Body() dto: RespondOfferDto,
  ) { return this.campaigns.respondToOffer(uid, campaignId, offerId, dto); }

  @Post('campaigns/:campaignId/offers/:offerId/lock-funds')
  lockFunds(
    @CurrentUser('id') uid: string,
    @Param('campaignId') campaignId: string,
    @Param('offerId') offerId: string,
  ) { return this.campaigns.lockFunds(uid, campaignId, offerId); }

  @Post('campaigns/:campaignId/offers/:offerId/proof')
  submitProof(
    @CurrentUser('id') uid: string,
    @Param('campaignId') campaignId: string,
    @Param('offerId') offerId: string,
    @Body() dto: SubmitProofDto,
  ) { return this.campaigns.submitProof(uid, campaignId, offerId, dto); }

  // ── Campaign analytics ──────────────────────────────────────────────────────

  @Get('campaigns/:id/analytics')
  getCampaignAnalytics(@CurrentUser('id') uid: string, @Param('id') id: string, @Query() _dto: CampaignAnalyticsDto) {
    return this.metrics.getCampaignAnalytics(uid, id);
  }

  // ── Escrow ──────────────────────────────────────────────────────────────────

  @Get('escrow/mine')
  myEscrows(@CurrentUser('id') uid: string) { return this.escrow.findByAdvertiser(uid); }

  @Get('escrow/creator')
  creatorEscrows(@CurrentUser('id') uid: string) { return this.escrow.findByCreator(uid); }

  @Get(':id/media-kit')
  @Public()
  mediaKit(@Param('id') id: string) { return this.svc.getMediaKit(id); }

  @Get(':id')
  get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateCreatorDto) { return this.svc.createCreator(uid, dto); }

  @Patch(':id')
  update(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCreatorDto) {
    return this.svc.updateCreator(uid, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.remove(uid, id); }

  @Post(':id/sync')
  sync(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: SyncCreatorDto) {
    return this.svc.syncPlatform(uid, id, dto);
  }

  @Post(':id/refresh-metrics')
  refreshMetrics(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.get(uid, id).then(() => this.metrics.syncCreator(id));
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  /**
   * Initiate a tier upgrade via PalmPesa USSD push.
   * Returns immediately with a pending subscription record.
   * Tier is activated when PalmPesa posts the payment callback.
   */
  @Post(':id/subscribe')
  subscribe(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpgradeSubscriptionDto,
  ) {
    // Verify ownership before charging
    return this.svc.get(uid, id).then(() =>
      this.subscriptions.initiateUpgrade({
        creatorId: id,
        tier: dto.tier,
        phone: dto.phone,
        name: dto.name,
        email: dto.email,
      }),
    );
  }

  /** Active subscription for this creator profile */
  @Get(':id/subscription')
  getSubscription(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.get(uid, id).then(() =>
      this.subscriptions.getActiveSubscription(id),
    );
  }

  /** Full billing history */
  @Get(':id/subscription/history')
  getSubscriptionHistory(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.get(uid, id).then(() =>
      this.subscriptions.getHistory(id),
    );
  }
}
