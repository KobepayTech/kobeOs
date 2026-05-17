import { Body, Controller, Delete, Get, Headers, Post, Put, Query, UseGuards } from '@nestjs/common';
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
   * Publish this store to kobeapptz.com.
   * The Authorization header JWT is forwarded to the central registry.
   * POST /api/store-settings/publish
   */
  @Post('publish')
  publish(
    @CurrentUser('id') uid: string,
    @Headers('authorization') auth: string,
  ) {
    const jwt = auth?.replace(/^Bearer\s+/i, '') ?? '';
    return this.publishSvc.publish(uid, jwt);
  }

  /**
   * Remove this store from kobeapptz.com.
   * DELETE /api/store-settings/publish
   */
  @Delete('publish')
  unpublish(
    @CurrentUser('id') uid: string,
    @Headers('authorization') auth: string,
  ) {
    const jwt = auth?.replace(/^Bearer\s+/i, '') ?? '';
    return this.publishSvc.unpublish(uid, jwt);
  }

  /**
   * Heartbeat — called by the frontend every 5 minutes while the store is published.
   * Forwards to the central registry to keep the DNS record active.
   * POST /api/store-settings/heartbeat
   */
  @Post('heartbeat')
  heartbeat(
    @CurrentUser('id') uid: string,
    @Headers('authorization') auth: string,
  ) {
    const jwt = auth?.replace(/^Bearer\s+/i, '') ?? '';
    return this.publishSvc.heartbeat(uid, jwt);
  }

  /**
   * Check if a slug is available before publishing.
   * GET /api/store-settings/check-slug?slug=kelvinfashion
   * Public — no auth needed.
   */
  @Public()
  @Get('check-slug')
  checkSlug(@Query('slug') slug: string) {
    return this.publishSvc.checkSlug(slug ?? '');
  }
}
