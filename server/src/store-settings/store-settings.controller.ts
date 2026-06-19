import { BadRequestException, Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { StoreSettingsService } from './store-settings.service';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';
import { PublishService } from './publish.service';

const MAX_SLUG_QUERY_LENGTH = 64;

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
  async upsert(@CurrentUser('id') uid: string, @Body() dto: UpsertStoreSettingsDto) {
    const before = await this.svc.get(uid);
    const saved  = await this.svc.upsert(uid, dto);

    // Auto-publish the subdomain when the operator saves a valid store name.
    // Hosted mode = free DB flip. Self-hosted = spawn cloudflared (best-effort).
    // Republish when the slug changed so {newSlug}.kobeapptz.com starts
    // resolving without a separate "Publish" click. Saves stay successful
    // even if publishing fails — the operator can retry from the editor.
    const slugChanged = saved.domainSlug && saved.domainSlug !== before.domainSlug;
    const needsFirstPublish = saved.domainSlug && !saved.isPublished;
    if (slugChanged || needsFirstPublish) {
      try {
        return await this.publishSvc.publish(uid);
      } catch (err) {
        // Surface in logs only; the saved settings still come back to the UI.
        // The editor displays cfStatus + has a manual Publish button for retry.
        console.warn(
          `[store-settings] auto-publish skipped for ${saved.domainSlug}: ${(err as Error).message}`,
        );
      }
    }
    return saved;
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
   * Public — no auth needed, but rate-limited (20/min per IP) so the
   * endpoint can't be used to enumerate registered subdomains.
   */
  @Public()
  @Throttle({ 'public-lookup': { limit: 20, ttl: 60_000 } })
  @Get('check-slug')
  checkSlug(@Query('slug') slug: string) {
    const trimmed = (slug ?? '').trim();
    if (trimmed.length > MAX_SLUG_QUERY_LENGTH) {
      throw new BadRequestException(`slug query is too long (max ${MAX_SLUG_QUERY_LENGTH} chars)`);
    }
    return this.svc.checkSlugAvailability(trimmed);
  }

  /**
   * One-time bootstrap of the shared wildcard tunnel + *.kobeapptz.com
   * CNAME used by hosted multi-tenant deployments. After this runs once,
   * publishing any number of stores is a zero-Cloudflare-call DB flip.
   * POST /api/store-settings/admin/bootstrap-wildcard
   *
   * Idempotent — safe to call repeatedly. Returns the cloudflared run
   * token; persist it as CLOUDFLARED_TOKEN and run cloudflared as a
   * system service.
   *
   * Requires an authenticated admin (any JWT today; a role check can be
   * layered later if needed).
   */
  @Post('admin/bootstrap-wildcard')
  bootstrapWildcard() {
    return this.publishSvc.bootstrapWildcardTunnel();
  }

  /**
   * Report whether a runnable `cloudflared` binary is available on this
   * machine. Lets the editor show an "Install cloudflared" call-to-action
   * instead of letting the publish click error out.
   * GET /api/store-settings/cloudflared-status
   */
  @Get('cloudflared-status')
  cloudflaredStatus() {
    return this.publishSvc.isCloudflaredInstalled();
  }

  /**
   * Download the cloudflared binary for this platform into the user-data
   * dir and make it executable. Used when the installer didn't ship one
   * (docker-built backend, manual server install, etc.). Idempotent —
   * always re-downloads so users can refresh stale binaries.
   * POST /api/store-settings/install-cloudflared
   */
  @Post('install-cloudflared')
  installCloudflared() {
    return this.publishSvc.installCloudflared();
  }
}
