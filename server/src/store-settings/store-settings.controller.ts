import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
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

  /** Publish this store via Cloudflare Tunnel. */
  @Post('publish')
  publish(@CurrentUser('id') uid: string) {
    return this.publishSvc.publish(uid);
  }

  /** Unpublish the store and tear down its tunnel + DNS record. */
  @Delete('publish')
  unpublish(@CurrentUser('id') uid: string) {
    return this.publishSvc.unpublish(uid);
  }
}
