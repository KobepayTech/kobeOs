import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CampaignsService, CouponsService, RulesService } from './discount.service';
import {
  CreateCampaignDto, CreateCouponDto, CreateRuleDto,
  UpdateCampaignDto, UpdateCouponDto, UpdateRuleDto,
} from './dto/discount.dto';

@UseGuards(JwtAuthGuard)
@Controller('discounts')
export class DiscountsController {
  constructor(
    private readonly rules: RulesService,
    private readonly coupons: CouponsService,
    private readonly campaigns: CampaignsService,
  ) {}

  @Get('rules') listRules(@CurrentUser('id') uid: string) { return this.rules.list(uid); }
  @Post('rules') createRule(@CurrentUser('id') uid: string, @Body() dto: CreateRuleDto) { return this.rules.create(uid, dto); }
  @Patch('rules/:id') updateRule(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateRuleDto) { return this.rules.update(uid, id, dto); }
  @Delete('rules/:id') removeRule(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.rules.remove(uid, id); }

  @Get('coupons') listCoupons(@CurrentUser('id') uid: string) { return this.coupons.list(uid); }
  @Post('coupons') createCoupon(@CurrentUser('id') uid: string, @Body() dto: CreateCouponDto) { return this.coupons.create(uid, dto); }
  @Patch('coupons/:id') updateCoupon(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCouponDto) { return this.coupons.update(uid, id, dto); }
  @Delete('coupons/:id') removeCoupon(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.coupons.remove(uid, id); }

  @Get('campaigns') listCampaigns(@CurrentUser('id') uid: string) { return this.campaigns.list(uid); }
  @Post('campaigns') createCampaign(@CurrentUser('id') uid: string, @Body() dto: CreateCampaignDto) { return this.campaigns.create(uid, dto); }
  @Patch('campaigns/:id') updateCampaign(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCampaignDto) { return this.campaigns.update(uid, id, dto); }
  @Delete('campaigns/:id') removeCampaign(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.campaigns.remove(uid, id); }
}
