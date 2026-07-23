import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { UpsertModuleSiteSettingsDto } from './dto/module-site-settings.dto';
import { ModuleSiteSettingsService } from './module-site-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('module-sites')
export class ModuleSiteSettingsController {
  constructor(private readonly svc: ModuleSiteSettingsService) {}

  @Public()
  @Throttle({ 'public-lookup': { limit: 40, ttl: 60_000 } })
  @Get('public/:moduleId/:slug')
  getPublic(@Param('moduleId') moduleId: string, @Param('slug') slug: string) {
    return this.svc.getPublic(moduleId, slug);
  }

  @Get(':moduleId/check-slug')
  checkSlug(
    @Param('moduleId') moduleId: string,
    @Query('slug') slug: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.checkSlugAvailability(moduleId, slug ?? '', uid);
  }

  @Get(':moduleId')
  get(@CurrentUser('id') uid: string, @Param('moduleId') moduleId: string) {
    return this.svc.get(uid, moduleId);
  }

  @Put(':moduleId')
  upsert(
    @CurrentUser('id') uid: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpsertModuleSiteSettingsDto,
  ) {
    return this.svc.upsert(uid, moduleId, dto);
  }

  @Post(':moduleId/publish')
  publish(@CurrentUser('id') uid: string, @Param('moduleId') moduleId: string) {
    return this.svc.publish(uid, moduleId);
  }

  @Delete(':moduleId/publish')
  unpublish(@CurrentUser('id') uid: string, @Param('moduleId') moduleId: string) {
    return this.svc.unpublish(uid, moduleId);
  }
}
