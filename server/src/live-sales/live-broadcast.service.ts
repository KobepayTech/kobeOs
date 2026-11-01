import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IsNull, Not, Repository } from 'typeorm';
import { LiveBroadcastSettings } from './live-broadcast.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';

export function streamEndpoint(raw: string, direction: 'publish' | 'play'): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new BadRequestException('Enter a valid Cloudflare Stream URL.'); }
  if (url.protocol !== 'https:' || !/^customer-[a-z0-9]+\.cloudflarestream\.com$/.test(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash
    || !new RegExp(`^/[A-Za-z0-9_-]{16,256}/webRTC/${direction}$`).test(url.pathname)) {
    throw new BadRequestException(`Use the Cloudflare Stream WebRTC ${direction} URL.`);
  }
  return url;
}

@Injectable()
export class LiveBroadcastService {
  constructor(
    @InjectRepository(LiveBroadcastSettings) private readonly settings: Repository<LiveBroadcastSettings>,
    @InjectRepository(LiveSession) private readonly sessions: Repository<LiveSession>,
    private readonly sales: LiveSaleService,
    private readonly config: ConfigService,
  ) {}

  async configuration(ownerId: string) {
    const row = await this.settings.findOne({ where: { ownerId } });
    return { configured: !!row, playbackUrl: row?.playbackUrl || '', canEnable: !!this.config.get<string>('CF_STREAM_API_TOKEN') && /^[a-f0-9]{32}$/i.test(this.config.get<string>('CF_STREAM_ACCOUNT_ID') || '') };
  }

  async provision(ownerId: string) {
    const context = await this.sales.operatorContext(ownerId);
    if (!context.storePublished) throw new BadRequestException('Publish your shop before enabling store video.');
    const token = this.config.get<string>('CF_STREAM_API_TOKEN')?.trim();
    const accountId = this.config.get<string>('CF_STREAM_ACCOUNT_ID')?.trim();
    if (!token || !/^[a-f0-9]{32}$/i.test(accountId || '')) throw new ServiceUnavailableException('Store video is being configured. Please contact your administrator.');
    return this.settings.manager.transaction(async manager => {
      // Serialize the one-time setup across API instances; repeated clicks reuse the same input.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`store-video:${ownerId}`]);
      const settings = manager.getRepository(LiveBroadcastSettings);
      const existing = await settings.findOne({ where: { ownerId } });
      if (existing) return { configured: true, playbackUrl: existing.playbackUrl, canEnable: true };
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: { name: `KobeOS store ${ownerId}`, kobeOwnerId: ownerId }, defaultCreator: ownerId, recording: { mode: 'off' } }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json() as { success?: boolean; result?: { webRTC?: { url?: string }; webRTCPlayback?: { url?: string } } };
      if (!response.ok || !data.success || !data.result?.webRTC?.url || !data.result.webRTCPlayback?.url) throw new ServiceUnavailableException('Store video could not be enabled. Please try again or contact your administrator.');
      const publish = streamEndpoint(data.result.webRTC.url, 'publish');
      const playback = streamEndpoint(data.result.webRTCPlayback.url, 'play');
      if (publish.origin !== playback.origin) throw new ServiceUnavailableException('The video provider returned an invalid connection.');
      await settings.save(settings.create({ ownerId, publishUrl: publish.href, playbackUrl: playback.href }));
      return { configured: true, playbackUrl: playback.href, canEnable: true };
    });
  }

  async configure(ownerId: string, publishUrl: string, playbackUrl: string) {
    const publish = streamEndpoint(publishUrl, 'publish');
    const playback = streamEndpoint(playbackUrl, 'play');
    if (publish.origin !== playback.origin) throw new BadRequestException('Both URLs must belong to the same Cloudflare Stream account.');
    const active = await this.sessions.count({ where: { ownerId, status: 'LIVE', broadcastPlaybackUrl: Not(IsNull()) } });
    if (active) throw new BadRequestException('Stop the current store broadcast before changing its connection.');
    await this.settings.upsert({ ownerId, publishUrl: publish.href, playbackUrl: playback.href }, ['ownerId']);
    return this.configuration(ownerId);
  }

  async start(ownerId: string, sessionId: string) {
    const session = await this.sales.getSession(ownerId, sessionId);
    if (session.status !== 'LIVE' || session.kind !== 'live' || session.platform !== 'other') {
      throw new BadRequestException('Open an active store-camera session first.');
    }
    // Lock the merchant's single video input so two sessions cannot advertise it.
    return this.settings.manager.transaction(async manager => {
      const row = await manager.getRepository(LiveBroadcastSettings).createQueryBuilder('settings')
        .addSelect('settings.publishUrl').where('settings.ownerId = :ownerId', { ownerId })
        .setLock('pessimistic_write').getOne();
      if (!row) throw new ServiceUnavailableException('Store video is not connected yet. Complete video setup before going live.');
      const sessions = manager.getRepository(LiveSession);
      const other = await sessions.findOne({ where: { ownerId, status: 'LIVE', broadcastPlaybackUrl: Not(IsNull()) } });
      if (other) throw new BadRequestException('A store broadcast is already open. Stop it before starting another.');
      // An end-session request must not race with starting video.
      const current = await sessions.findOne({ where: { ownerId, id: sessionId }, lock: { mode: 'pessimistic_write' } });
      if (!current || current.status !== 'LIVE') throw new BadRequestException('This sales session has ended.');
      current.broadcastPlaybackUrl = row.playbackUrl;
      await sessions.save(current);
      return { publishUrl: row.publishUrl, playbackUrl: row.playbackUrl };
    });
  }

  async stop(ownerId: string, sessionId: string) {
    await this.sales.getSession(ownerId, sessionId);
    await this.sessions.update({ ownerId, id: sessionId }, { broadcastPlaybackUrl: null });
    return { stopped: true };
  }
}
