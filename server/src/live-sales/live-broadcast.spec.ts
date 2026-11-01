import { Repository } from 'typeorm';
import { LiveBroadcastSettings } from './live-broadcast.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';
import { LiveBroadcastService, streamEndpoint } from './live-broadcast.service';

describe('store camera broadcast security', () => {
  const publish = 'https://customer-example.cloudflarestream.com/' + 'a'.repeat(32) + '/webRTC/publish';
  const playback = 'https://customer-example.cloudflarestream.com/' + 'b'.repeat(32) + '/webRTC/play';
  it.each([publish.replace('https:', 'http:'), publish.replace('.com/', '.com.evil.test/'), publish + '?secret=test', 'https://127.0.0.1/webRTC/publish'])('rejects invalid video endpoint %s', value => {
    expect(() => streamEndpoint(value, 'publish')).toThrow();
  });
  it('returns safe configuration without the publish capability', async () => {
    const settings = { findOne: jest.fn().mockResolvedValue({ publishUrl: publish, playbackUrl: playback }) };
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, {} as LiveSaleService);
    expect(await service.configuration('owner')).toEqual({ configured: true, playbackUrl: playback });
    expect(settings.findOne).toHaveBeenCalledWith({ where: { ownerId: 'owner' } });
  });
  it('rejects mixed accounts and does not save their credentials', async () => {
    const settings = { upsert: jest.fn() };
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, {} as LiveSaleService);
    await expect(service.configure('owner', publish, playback.replace('customer-example', 'customer-other'))).rejects.toThrow('same Cloudflare');
    expect(settings.upsert).not.toHaveBeenCalled();
  });
  it('checks session ownership before accessing private broadcast settings', async () => {
    const settings = { manager: { transaction: jest.fn() } };
    const sales = { getSession: jest.fn().mockRejectedValue(new Error('Session not found')) };
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService);
    await expect(service.start('other-owner', 'session')).rejects.toThrow('Session not found');
    expect(settings.manager.transaction).not.toHaveBeenCalled();
  });
  it('does not treat a TikTok selling session as a store camera broadcast', async () => {
    const sales = { getSession: jest.fn().mockResolvedValue({ status: 'LIVE', kind: 'live', platform: 'tiktok' }) };
    const service = new LiveBroadcastService({} as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService);
    await expect(service.start('owner', 'session')).rejects.toThrow('store-camera');
  });
});
