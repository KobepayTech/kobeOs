import { Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { StoreSettingsService } from './store-settings.service';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';
import { PublishService } from './publish.service';

@UseGuards(JwtAuthGuard)
@Controller('store-settings')
export class StoreSettingsController {
  constructor(
    private readonly svc: StoreSettingsService,
    private readonly publishSvc: PublishService,
  ) {}

  @Get()
  get(@CurrentUser('id') uid: string) {
    return this.svc.get(uid);
  }

  @Put()
  upsert(@CurrentUser('id') uid: string, @Body() dto: UpsertStoreSettingsDto) {
    return this.svc.upsert(uid, dto);
  }

  /**
   * Publish this store to kobeapptz.com via Cloudflare Tunnel.
   * Creates the tunnel, DNS record, and spawns cloudflared locally.
   * POST /api/store-settings/publish
   */
  @Post('publish')
  publish(@CurrentUser('id') uid: string) {
    return this.publishSvc.publish(uid);
  }

  /**
   * Unpublish — stops the tunnel and removes the DNS record.
   * DELETE /api/store-settings/publish
   */
  @Delete('publish')
  unpublish(@CurrentUser('id') uid: string) {
    return this.publishSvc.unpublish(uid);
  }

  /**
   * Check whether the local cloudflared tunnel process is running.
   * GET /api/store-settings/tunnel-status
   */
  @Get('tunnel-status')
  tunnelStatus(@CurrentUser('id') uid: string) {
    return this.publishSvc.tunnelStatus(uid);
  }

  /**
   * Check if a slug is available before publishing.
   * GET /api/store-settings/check-slug?slug=kelvinfashion
   * Public — no auth needed.
   */
  @Public()
  @Get('check-slug')
  checkSlug(@Query('slug') slug: string) {
    return this.svc.checkSlugAvailability(slug ?? '');
  }
}
