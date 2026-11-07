import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/public.decorator';
import { SyncTokenGuard } from './sync-token.guard';
import {
  ContinuitySyncService,
  type CatalogueSnapshot,
  type MediaPayload,
} from './continuity-sync.service';

/**
 * The cloud side of continuity sync.
 *
 * Served by whichever instance is acting as the cloud; the origin calls these.
 * `@Public()` only skips the user JWT — SyncTokenGuard still requires the
 * shared machine secret, and refuses outright when it is unconfigured.
 *
 * Throttling is skipped because a sync pass is a handful of calls from one
 * known peer, and rate-limiting the path that carries already-taken money off
 * the cloud would turn a busy minute into unreconciled revenue.
 */
@Public()
@UseGuards(SyncTokenGuard)
@SkipThrottle({ default: true, auth: true, 'public-lookup': true })
@Controller('continuity')
export class ContinuitySyncController {
  constructor(private readonly sync: ContinuitySyncService) {}

  /** Receive the catalogue the origin has allotted to this instance. */
  @Post('catalogue')
  async catalogue(@Body() snapshot: CatalogueSnapshot) {
    return this.sync.applyCatalogueSnapshot(snapshot);
  }

  /**
   * Receive image bytes for catalogue entries this instance cannot serve yet.
   * Sent only in response to the missingMedia list from a catalogue push, so
   * bytes cross once rather than on every pass.
   */
  @Post('media')
  async media(@Body() body: { items?: MediaPayload[] }) {
    return this.sync.applyMedia(body?.items ?? []);
  }

  /** Hand over transactions this instance originated. */
  @Get('outbox')
  async outbox(@Query('limit') limit?: string) {
    const items = await this.sync.pendingForPeer(Number(limit) || 100);
    return { items, count: items.length };
  }

  /** Confirm the origin has absorbed them. */
  @Post('outbox/ack')
  async acknowledge(@Body() body: { ids?: string[] }) {
    const acknowledged = await this.sync.acknowledgeForPeer(body?.ids ?? []);
    return { acknowledged };
  }
}
