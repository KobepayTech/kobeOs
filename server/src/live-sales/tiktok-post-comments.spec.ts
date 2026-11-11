import type { Repository } from 'typeorm';
import type { AuditService } from '../audit/audit.service';
import type { SocialAccount } from '../social-scheduler/social-account.entity';
import type { LiveSession } from './live-sale.entity';
import type { LiveSaleService } from './live-sale.service';
import { TikTokPostCommentsService } from './tiktok-post-comments.service';

describe('TikTok Business post comments', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads an owned post, ignores the merchant and replies publicly without a checkout token', async () => {
    const videoId = '7400123456789012345';
    const commentId = '7400123456789012347';
    const session = { id: 'sale', ownerId: 'owner', socialAccountId: 'business', createdAt: new Date(Date.now() - 10000),
      postUrl: `https://www.tiktok.com/@shop/video/${videoId}` };
    const sessions = { find: jest.fn().mockResolvedValue([session]) };
    const accounts = { findOne: jest.fn().mockResolvedValue({ accessToken: 'token', metadata: { businessId: 'open-id' } }) };
    const sales = { ingestComment: jest.fn().mockResolvedValue({ reply: 'secret', publicReply: 'TZS 25,000 · https://shop.example.com' }) };
    const service = new TikTokPostCommentsService(sessions as unknown as Repository<LiveSession>,
      accounts as unknown as Repository<SocialAccount>, sales as unknown as LiveSaleService, {} as AuditService);
    const now = Math.floor(Date.now() / 1000);
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(`{"code":0,"data":{"comments":[
      {"video_id":${videoId},"comment_id":${commentId},"owner":false,"status":"PUBLIC","create_time":"${now}","text":"How much?","username":"buyer"},
      {"video_id":"${videoId}","comment_id":"6","owner":true,"status":"PUBLIC","create_time":"${now}","text":"How much?"}
    ],"has_more":false}}`)).mockResolvedValueOnce(new Response('{"code":0}'));
    await service.poll();
    expect(sales.ingestComment).toHaveBeenCalledTimes(1);
    expect(sales.ingestComment).toHaveBeenCalledWith('owner', 'sale', {
      externalId: commentId, buyerHandle: 'buyer', source: 'post-tiktok', text: 'How much?',
    });
    expect(String(fetcher.mock.calls[0][0])).toContain(`business/comment/list/?business_id=open-id&video_id=${videoId}`);
    expect(String(fetcher.mock.calls[1][0])).toContain('/business/comment/reply/create/');
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      business_id: 'open-id', video_id: videoId, comment_id: commentId, text: 'TZS 25,000 · https://shop.example.com',
    });
  });
});
