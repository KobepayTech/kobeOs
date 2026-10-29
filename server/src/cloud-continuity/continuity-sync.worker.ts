import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ContinuitySyncService,
  type CatalogueSnapshot,
  type OutboxItem,
  type SyncTransport,
} from './continuity-sync.service';

/** Talks to the peer's /api/continuity endpoints with the shared machine token. */
export class HttpSyncTransport implements SyncTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs = 20_000,
  ) {}

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/continuity${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-continuity-token': this.token,
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async pushCatalogue(snapshot: CatalogueSnapshot): Promise<void> {
    await this.call('/catalogue', { method: 'POST', body: JSON.stringify(snapshot) });
  }

  async pullOutbox(limit: number): Promise<OutboxItem[]> {
    const body = await this.call<{ items?: OutboxItem[] }>(`/outbox?limit=${limit}`, { method: 'GET' });
    return body.items ?? [];
  }

  async acknowledge(ids: string[]): Promise<void> {
    await this.call('/outbox/ack', { method: 'POST', body: JSON.stringify({ ids }) });
  }
}

/**
 * Runs a sync pass on a schedule.
 *
 * Inert unless both CONTINUITY_PEER_URL and CONTINUITY_SYNC_TOKEN are set, so
 * the desktop and single-shop installs that have no cloud peer carry no extra
 * load and log nothing.
 *
 * Passes never overlap. A pass that is slow because the peer is slow would
 * otherwise pile up behind itself and pull the same outbox rows into two
 * absorptions at once — safe, because absorption is idempotent, but it would
 * waste the window during which the backlog is still small.
 */
@Injectable()
export class ContinuitySyncWorker {
  private readonly logger = new Logger('ContinuitySyncWorker');
  private running = false;
  private consecutiveFailures = 0;

  constructor(
    private readonly sync: ContinuitySyncService,
    private readonly config: ConfigService,
  ) {}

  private transport(): SyncTransport | null {
    const base = String(this.config.get('CONTINUITY_PEER_URL') ?? '').replace(/\/+$/, '');
    const token = String(this.config.get('CONTINUITY_SYNC_TOKEN') ?? '');
    if (!base || token.length < 32) return null;
    return new HttpSyncTransport(base, token);
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'continuity-sync' })
  async tick(): Promise<void> {
    const transport = this.transport();
    if (!transport || this.running) return;

    this.running = true;
    try {
      const result = await this.sync.runOnce(transport);
      this.consecutiveFailures = 0;
      if (result.pulled || result.failed) {
        this.logger.log(
          `pass: pulled=${result.pulled} absorbed=${result.absorbed} failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.consecutiveFailures += 1;
      // Quiet after the first few: an unreachable peer is the normal state
      // during an outage, and a log line a minute buries everything else.
      if (this.consecutiveFailures <= 3 || this.consecutiveFailures % 30 === 0) {
        this.logger.warn(
          `pass failed (${this.consecutiveFailures} in a row): `
          + String((error as Error)?.message).slice(0, 200),
        );
      }
    } finally {
      this.running = false;
    }
  }
}
