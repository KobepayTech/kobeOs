import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MobileSubscriptionService } from './mobile-subscription.service';
import { SubscribeMobileDto, SubscribeMobileModuleDto } from './dto/subscribe.dto';

/**
 * Gates the /m/:slug mobile workspace behind a 48h trial then a monthly
 * PalmPesa subscription. Sign-in is required (global JwtAuthGuard) — a shopper
 * can't probe a shop's billing state anonymously.
 */
@UseGuards(JwtAuthGuard)
@Controller('mobile-access')
export class MobileSubscriptionController {
  constructor(private readonly svc: MobileSubscriptionService) {}

  /** Current access for a shop (starts the 48h trial on first call). */
  @Get()
  access(@Query('slug') slug: string) {
    return this.svc.getAccess(slug);
  }

  /** Start a PalmPesa USSD push for the shop's monthly subscription. */
  @Post('subscribe')
  subscribe(@Request() req: { user: { id: string } }, @Body() dto: SubscribeMobileDto) {
    return this.svc.subscribe(dto.slug, req.user.id, dto.msisdn);
  }

  /** Purchase one optional module; it remains hidden until payment settles. */
  @Post('modules/subscribe')
  subscribeModule(
    @Request() req: { user: { id: string } },
    @Body() dto: SubscribeMobileModuleDto,
  ) {
    return this.svc.subscribeModule(dto.slug, req.user.id, dto.msisdn, dto.moduleId);
  }

  /** Poll payment status after the USSD push. */
  @Get('status/:transactionId')
  status(@Param('transactionId') transactionId: string) {
    return this.svc.getStatus(transactionId);
  }
}
