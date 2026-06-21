import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/campaigns.dto';

/**
 * Customer messaging — bulk SMS + WhatsApp template sends with a
 * persistent send history. Backed by Beem Africa.
 *
 * GET  /notifications/customers       — distinct phones from POS history
 * GET  /notifications/campaigns       — past campaigns (newest first)
 * GET  /notifications/campaigns/:id   — campaign + per-recipient status
 * POST /notifications/campaigns       — create + kick off a send
 * POST /notifications/campaigns/:id/retry — re-send to just the failed rows
 */
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get('customers')
  customers(@CurrentUser('id') uid: string) { return this.svc.customers(uid); }

  @Get('campaigns')
  list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }

  @Get('campaigns/:id')
  get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }

  @Post('campaigns')
  create(@CurrentUser('id') uid: string, @Body() dto: CreateCampaignDto) {
    return this.svc.create(uid, dto);
  }

  @Post('campaigns/:id/retry')
  retry(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.retryFailures(uid, id);
  }
}
