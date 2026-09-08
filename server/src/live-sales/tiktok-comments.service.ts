import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { TikTokLiveConnection, ControlEvent, WebcastEvent } from 'tiktok-live-connector';
import { SocialAccount } from '../social-scheduler/social-account.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';

type ConnectionState = {
  client: TikTokLiveConnection; status: 'connecting' | 'connected' | 'waiting';
  detail: string; lastCommentAt: string | null; nextAttempt: number; failures: number;
  queue: Promise<void>; pending: number;
};

/** The native TikTok app keeps broadcasting; this connector receives public chat only. */
@Injectable()
export class TikTokCommentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TikTokCommentsService.name);
  private readonly connections = new Map<string, ConnectionState>();
  private readonly starting = new Map<string, Promise<void>>();
  private reconciling = false;
  private stopped = false;
  constructor(
    @InjectRepository(LiveSession) private readonly sessions: Repository<LiveSession>,
    @InjectRepository(SocialAccount) private readonly accounts: Repository<SocialAccount>,
    private readonly sales: LiveSaleService,
  ) {}
  onModuleInit() { void this.reconcile().catch(() => this.logger.warn('TikTok comments will retry when the database is ready.')); }
  async onModuleDestroy() {
    this.stopped = true;
    await Promise.all([...this.connections.keys()].map((id) => this.stop(id)));
  }
  @Cron('*/30 * * * * *')
  async reconcile() {
    if (this.stopped || this.reconciling) return;
    this.reconciling = true;
    try {
      const live = await this.sessions.find({ where: { platform: 'tiktok', kind: 'live', status: 'LIVE' } });
      const ids = new Set(live.map((session) => session.id));
      for (const id of this.connections.keys()) if (!ids.has(id)) await this.stop(id);
      for (const session of live) {
        if (this.stopped) break;
        await this.start(session);
      }
    } finally { this.reconciling = false; }
  }
  start(session: LiveSession): Promise<void> {
    const pending = this.starting.get(session.id);
    if (pending) return pending;
    const task = this.connect(session).finally(() => this.starting.delete(session.id));
    this.starting.set(session.id, task);
    return task;
  }
  private async connect(session: LiveSession) {
    if (this.stopped || session.platform !== 'tiktok' || session.kind !== 'live' || session.status !== 'LIVE') return;
    let state = this.connections.get(session.id);
    if (state && (state.status !== 'waiting' || state.nextAttempt > Date.now())) return;
    if (!state) {
      const account = session.socialAccountId ? await this.accounts.findOne({ where: { id: session.socialAccountId, ownerId: session.ownerId, platform: 'tiktok', status: 'connected' } }) : null;
      const handle = (account?.accountHandle || session.sourceHandle || '').replace(/^@/, '').trim();
      if (!/^[A-Za-z0-9._]{1,64}$/.test(handle) || this.stopped) return;
      // OAuth/session cookies are deliberately not passed to the public-chat provider.
      const client = new TikTokLiveConnection(handle, { processInitialData: false, authenticateWs: false, ...(process.env.TIKTOK_LIVE_SIGN_API_KEY ? { signApiKey: process.env.TIKTOK_LIVE_SIGN_API_KEY } : {}) });
      state = { client, status: 'waiting', detail: 'Waiting for your phone broadcast.', lastCommentAt: null, nextAttempt: 0, failures: 0, queue: Promise.resolve(), pending: 0 };
      this.connections.set(session.id, state);
      const active = state;
      client.on(ControlEvent.ERROR, () => { active.detail = 'TikTok comments need to reconnect. Your live shop remains available.'; });
      client.on(ControlEvent.DISCONNECTED, () => { active.status = 'waiting'; active.nextAttempt = Date.now() + 30000; });
      client.on(WebcastEvent.CHAT, (event) => {
        if (this.stopped || this.connections.get(session.id) !== active || !event.comment) return;
        if (active.pending >= 500) { active.detail = 'Comment traffic is high; some comments may need manual entry.'; return; }
        active.pending += 1;
        active.queue = active.queue.then(async () => {
          if (this.stopped || this.connections.get(session.id) !== active) return;
          const payload = event as unknown as { common?: { msgId?: string }; msgId?: string };
          await this.sales.ingestComment(session.ownerId, session.id, { source: 'tiktok', buyerHandle: event.user?.uniqueId || '', text: event.comment.slice(0, 1000), externalId: String(payload.common?.msgId || payload.msgId || '') });
          active.lastCommentAt = new Date().toISOString();
        }).catch(() => { active.detail = 'A comment could not be saved. Check the backend connection.'; }).finally(() => { active.pending -= 1; });
      });
    }
    state.status = 'connecting';
    try {
      const client = state.client;
      let expired = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.connect().then(async () => { if (expired) await client.disconnect(); }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => { expired = true; void client.disconnect().catch(() => undefined); reject(new Error('Comment connection timed out')); }, 20000); }),
        ]);
      } finally { if (timeout) clearTimeout(timeout); }
      if (this.stopped || this.connections.get(session.id) !== state) { await state.client.disconnect(); return; }
      state.status = 'connected'; state.detail = 'Receiving comments from your phone live.'; state.failures = 0;
    } catch {
      state.status = 'waiting'; state.failures += 1;
      state.nextAttempt = Date.now() + Math.min(300000, 30000 * 2 ** Math.min(state.failures - 1, 4));
      state.detail = 'Waiting for TikTok Live comments. Start Live on your phone; Kobe retries automatically. If this persists, the comment provider needs setup.';
    }
  }
  async stop(id: string) {
    await this.starting.get(id)?.catch(() => undefined);
    const state = this.connections.get(id);
    this.connections.delete(id);
    if (state) await state.client.disconnect().catch(() => undefined);
  }
  status(id: string) {
    const state = this.connections.get(id);
    return state ? { status: state.status, detail: state.detail, lastCommentAt: state.lastCommentAt }
      : { status: 'waiting', detail: 'Select a connected TikTok account to receive phone-live comments.', lastCommentAt: null };
  }
}
