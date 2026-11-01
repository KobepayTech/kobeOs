import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { LiveBroadcastSettings } from './live-broadcast.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';
import { LiveBroadcastService, streamEndpoint } from './live-broadcast.service';

describe('store camera broadcast security', () => {
  afterEach(() => jest.restoreAllMocks());
  const publish = 'https://customer-example.cloudflarestream.com/' + 'a'.repeat(32) + '/webRTC/publish';
  const playback = 'https://customer-example.cloudflarestream.com/' + 'b'.repeat(32) + '/webRTC/play';
  it.each([publish.replace('https:', 'http:'), publish.replace('.com/', '.com.evil.test/'), publish + '?secret=test', 'https://127.0.0.1/webRTC/publish'])('rejects invalid video endpoint %s', value => {
    expect(() => streamEndpoint(value, 'publish')).toThrow();
  });
  it('returns safe configuration without the publish capability', async () => {
    const settings = { findOne: jest.fn().mockResolvedValue({ publishUrl: publish, playbackUrl: playback }) };
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, {} as LiveSaleService, new ConfigService());
    expect(await service.configuration('owner')).toEqual({ configured: true, playbackUrl: playback, canEnable: false });
    expect(settings.findOne).toHaveBeenCalledWith({ where: { ownerId: 'owner' } });
  });
  it('rejects mixed accounts and does not save their credentials', async () => {
    const settings = { upsert: jest.fn() };
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, {} as LiveSaleService, new ConfigService());
    await expect(service.configure('owner', publish, playback.replace('customer-example', 'customer-other'))).rejects.toThrow('same Cloudflare');
    expect(settings.upsert).not.toHaveBeenCalled();
  });
  it('checks session ownership before accessing private broadcast settings', async () => {
    const settings = { manager: { transaction: jest.fn() } };
    const sales = { getSession: jest.fn().mockRejectedValue(new Error('Session not found')) };
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService, new ConfigService());
    await expect(service.start('other-owner', 'session')).rejects.toThrow('Session not found');
    expect(settings.manager.transaction).not.toHaveBeenCalled();
  });
  it('does not treat a TikTok selling session as a store camera broadcast', async () => {
    const sales = { getSession: jest.fn().mockResolvedValue({ status: 'LIVE', kind: 'live', platform: 'tiktok' }) };
    const service = new LiveBroadcastService({} as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService, new ConfigService());
    await expect(service.start('owner', 'session')).rejects.toThrow('store-camera');
  });

  it('reuses an existing merchant video input instead of creating another', async () => {
    const manager = { query: jest.fn(), getRepository: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue({ playbackUrl: playback }) }) };
    const settings = { manager: { transaction: jest.fn(async callback => callback(manager)) } };
    const sales = { operatorContext: jest.fn().mockResolvedValue({ storePublished: true }) };
    const config = new ConfigService({ CF_STREAM_ACCOUNT_ID: 'a'.repeat(32), CF_STREAM_API_TOKEN: 'test-token' });
    const fetcher = jest.spyOn(global, 'fetch');
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService, config);
    expect(await service.provision('owner')).toEqual({ configured: true, playbackUrl: playback, canEnable: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['store-video:owner']);
  });

  it('creates a dedicated input with recording off and returns no publish secret', async () => {
    const rows = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn(value => value), save: jest.fn() };
    const manager = { query: jest.fn(), getRepository: jest.fn().mockReturnValue(rows) };
    const settings = { manager: { transaction: jest.fn(async callback => callback(manager)) } };
    const sales = { operatorContext: jest.fn().mockResolvedValue({ storePublished: true }) };
    const config = new ConfigService({ CF_STREAM_ACCOUNT_ID: 'a'.repeat(32), CF_STREAM_API_TOKEN: 'test-token' });
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, result: { webRTC: { url: publish }, webRTCPlayback: { url: playback } } }), { status: 200 }));
    const service = new LiveBroadcastService(settings as unknown as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService, config);
    expect(await service.provision('owner')).toEqual({ configured: true, playbackUrl: playback, canEnable: true });
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toMatchObject({ defaultCreator: 'owner', recording: { mode: 'off' } });
    expect(rows.save).toHaveBeenCalledWith({ ownerId: 'owner', publishUrl: publish, playbackUrl: playback });
  });

  it('does not allocate paid video resources before shop publication', async () => {
    const sales = { operatorContext: jest.fn().mockResolvedValue({ storePublished: false }) };
    const fetcher = jest.spyOn(global, 'fetch');
    const service = new LiveBroadcastService({} as Repository<LiveBroadcastSettings>, {} as Repository<LiveSession>, sales as unknown as LiveSaleService, new ConfigService());
    await expect(service.provision('owner')).rejects.toThrow('Publish your shop');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
