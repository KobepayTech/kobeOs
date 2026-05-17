import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { CreatorsService } from './creators.service';
import { CampaignService } from './campaign.service';
import { EscrowService } from './escrow.service';
import { MetricsEngineService } from './metrics-engine.service';
import { CreateCreatorDto, SearchCreatorsDto, SyncCreatorDto, UpdateCreatorDto } from './dto/creator.dto';
import {
  CreateCampaignDto, RespondOfferDto, SendOfferDto,
  SubmitProofDto, UpdateCampaignDto,
} from './dto/campaign.dto';

@UseGuards(JwtAuthGuard)
@Controller('creators')
export class CreatorsController {
  constructor(
    private readonly svc: CreatorsService,
    private readonly campaigns: CampaignService,
    private readonly escrow: EscrowService,
    private readonly metrics: MetricsEngineService,
  ) {}

  @Get()
  list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }

  @Get('search')
  @Public()
  search(@Query() dto: SearchCreatorsDto) { return this.svc.search(dto); }

  @Get('marketplace')
  @Public()
  marketplace(@Query() dto: SearchCreatorsDto) { return this.svc.search(dto); }

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

  @Post('campaigns/:campaignId/offers/:offerId/proof')
  submitProof(
    @CurrentUser('id') uid: string,
    @Param('campaignId') campaignId: string,
    @Param('offerId') offerId: string,
    @Body() dto: SubmitProofDto,
  ) { return this.campaigns.submitProof(uid, campaignId, offerId, dto); }

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
}
