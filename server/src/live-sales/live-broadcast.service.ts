import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  ) {}

  async configuration(ownerId: string) {
    const row = await this.settings.findOne({ where: { ownerId } });
    return { configured: !!row, playbackUrl: row?.playbackUrl || '' };
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
