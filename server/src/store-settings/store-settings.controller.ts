import { Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { StoreSettingsService } from './store-settings.service';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';
import { PublishService } from './publish.service';

@Controller('store-settings')
export class StoreSettingsController {
  constructor(
    private readonly svc: StoreSettingsService,
    private readonly publishSvc: PublishService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  get(@CurrentUser('id') uid: string) {
    return this.svc.get(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  upsert(@CurrentUser('id') uid: string, @Body() dto: UpsertStoreSettingsDto) {
    return this.svc.upsert(uid, dto);
  }

  /** Publish this store via Cloudflare Tunnel. */
  @UseGuards(JwtAuthGuard)
  @Post('publish')
  publish(@CurrentUser('id') uid: string) {
    return this.publishSvc.publish(uid);
  }

  /** Unpublish the store and tear down its tunnel + DNS record. */
  @UseGuards(JwtAuthGuard)
  @Delete('publish')
  unpublish(@CurrentUser('id') uid: string) {
    return this.publishSvc.unpublish(uid);
  }

  /**
   * Live availability check for a candidate slug. Editor calls this
   * as the user types so they see green/red immediately instead of
   * being told on save. Public so the signed-out signup flow can
   * use the same endpoint.
   */
  @Public()
  @Get('check-slug')
  checkSlug(@Query('slug') slug: string) {
    return this.svc.checkSlug(slug ?? '');
  }
}
