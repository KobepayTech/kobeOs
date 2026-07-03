import { BadRequestException, Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { StoreSettingsService } from './store-settings.service';
import { UpsertStoreSettingsDto } from './dto/store-settings.dto';
import { PublishService } from './publish.service';
import { StoreSettings } from './store-settings.entity';

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
      // Auto-publish is best-effort and must NEVER make saving the store name
      // feel slow. In hosted mode it's a fast DB flip; in self-hosted mode it
      // makes Cloudflare/network calls that can hang for many seconds. Cap the
      // wait: if publish finishes quickly, return the published settings so the
      // UI flips to "Published" immediately; otherwise return the saved
      // settings now and let publish finish in the background (its result
      // lands on the next GET / manual Publish).
      const published = await this.raceAutoPublish(uid, saved.domainSlug);
      if (published) return published;
    }
    return saved;
  }

  /**
   * Run auto-publish but never block the save for more than AUTO_PUBLISH_MS.
   * The publish promise keeps running in the background if it loses the race
   * (its .catch swallows failures so it can't become an unhandled rejection).
   */
  private raceAutoPublish(uid: string, slug: string): Promise<StoreSettings | null> {
    const AUTO_PUBLISH_MS = 3000;
    const publishing = this.publishSvc.publish(uid).catch((err) => {
      console.warn(`[store-settings] auto-publish skipped for ${slug}: ${(err as Error).message}`);
      return null;
    });
    const timeout = new Promise<null>((resolve) => setTimeout(resolve, AUTO_PUBLISH_MS, null));
    return Promise.race([publishing, timeout]);
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
   * Onboarding hook — "install → sign in → live". Provisions the shop's
   * subdomain and (self-hosted) its own tunnel, returning the cloudflared run
   * token so the desktop app can persist it and start the tunnel automatically.
   * POST /api/store-settings/provision
   */
  @Post('provision')
  provision(@CurrentUser('id') uid: string) {
    return this.publishSvc.provisionShop(uid);
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
  checkSlug(
    @Query('slug') slug: string,
    @Query('ownerId') ownerId?: string,
  ) {
    const trimmed = (slug ?? '').trim();
    if (trimmed.length > MAX_SLUG_QUERY_LENGTH) {
      throw new BadRequestException(`slug query is too long (max ${MAX_SLUG_QUERY_LENGTH} chars)`);
    }
    return this.svc.checkSlugAvailability(trimmed, ownerId);
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

  /**
   * Publish-readiness preflight — a single checklist answering "can this
   * install put a store live at {slug}.kobeapptz.com?". Lets the Store
   * Editor show exactly what's missing (deployment mode, Cloudflare
   * credentials, wildcard bootstrap, cloudflared binary) instead of a
   * silent failure. Secret-free — presence booleans only.
   * GET /api/store-settings/publish-readiness
   */
  @Get('publish-readiness')
  publishReadiness() {
    return this.publishSvc.publishReadiness();
  }
}
