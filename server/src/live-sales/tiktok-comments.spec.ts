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
