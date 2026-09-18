import { EventEmitter } from 'events';
import { TikTokCommentsService } from './tiktok-comments.service';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { LiveSession } from './live-sale.entity';
import { Repository } from 'typeorm';
import { SocialAccount } from '../social-scheduler/social-account.entity';
import { LiveSaleService } from './live-sale.service';

jest.mock('tiktok-live-connector', () => ({
  TikTokLiveConnection: jest.fn(),
  ControlEvent: { ERROR: 'error', DISCONNECTED: 'disconnected' },
  WebcastEvent: { CHAT: 'chat' },
}));

describe('phone TikTok chat lifecycle', () => {
  it('caps simultaneous requests per owner and globally, then admits a waiting session after stop', async () => {
    process.env.TIKTOK_LIVE_MAX_CONNECTIONS = '2';
    process.env.TIKTOK_LIVE_MAX_PER_OWNER = '1';
    const clients: { connect: jest.Mock; disconnect: jest.Mock }[] = [];
    (TikTokLiveConnection as unknown as jest.Mock).mockImplementation(() => {
      const client = Object.assign(new EventEmitter(), { connect: jest.fn().mockResolvedValue({}), disconnect: jest.fn().mockResolvedValue(undefined) });
      clients.push(client); return client;
    });
    const service = new TikTokCommentsService({} as Repository<LiveSession>, {} as Repository<SocialAccount>, {} as LiveSaleService);
    const session = (id: string, ownerId: string) => ({ id, ownerId, sourceHandle: 'shop', platform: 'tiktok', kind: 'live', status: 'LIVE' } as LiveSession);
    try {
      await Promise.all([service.start(session('a', 'one')), service.start(session('b', 'one')), service.start(session('c', 'two')), service.start(session('d', 'three'))]);
      expect(clients).toHaveLength(2);
      expect(service.status('b').detail).toContain('capacity');
      expect(service.status('d').detail).toContain('capacity');
      await service.stop('a');
      await service.start(session('b', 'one'));
      expect(clients).toHaveLength(3);
      expect(service.status('b').status).toBe('connected');
    } finally { await service.onModuleDestroy(); delete process.env.TIKTOK_LIVE_MAX_CONNECTIONS; delete process.env.TIKTOK_LIVE_MAX_PER_OWNER; }
  });
  it('opens one connection, saves live comments and disconnects on end', async () => {
    const client = Object.assign(new EventEmitter(), { connect: jest.fn().mockResolvedValue({}), disconnect: jest.fn().mockResolvedValue(undefined) });
    (TikTokLiveConnection as unknown as jest.Mock).mockImplementation(() => client);
    const accounts = { findOne: jest.fn().mockResolvedValue({ accountHandle: '@myshop' }) };
    const sales = { ingestComment: jest.fn().mockResolvedValue({}) };
    const service = new TikTokCommentsService({} as Repository<LiveSession>, accounts as unknown as Repository<SocialAccount>, sales as unknown as LiveSaleService);
    const session = { id: 'sale', ownerId: 'owner', socialAccountId: 'account', platform: 'tiktok', kind: 'live', status: 'LIVE' } as LiveSession;
    await Promise.all([service.start(session), service.start(session)]);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(TikTokLiveConnection).toHaveBeenCalledWith('myshop', expect.objectContaining({ processInitialData: false, authenticateWs: false }));
    client.emit(WebcastEvent.CHAT, { user: { uniqueId: 'buyer' }, comment: 'A1 x2', common: { msgId: 'comment-id' } });
    await new Promise(resolve => setImmediate(resolve));
    expect(sales.ingestComment).toHaveBeenCalledWith('owner', 'sale', { source: 'tiktok', buyerHandle: 'buyer', text: 'A1 x2', externalId: 'comment-id' });
    expect(service.status('sale').status).toBe('connected');
    await service.stop('sale');
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(service.status('sale').status).toBe('waiting');
  });
});
