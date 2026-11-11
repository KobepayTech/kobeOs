import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { InstagramService } from './instagram.service';
import { relayTarget } from './relay-target';
import { Repository } from 'typeorm';
import { SocialAccount } from '../social-scheduler/social-account.entity';
import { LiveSession } from './live-sale.entity';
import { LiveSaleService } from './live-sale.service';

describe('phone live comments', () => {
  afterEach(() => jest.restoreAllMocks());
  it('connects numeric Instagram account IDs without losing their decimal digits', async () => {
    const config = new ConfigService({ INSTAGRAM_APP_ID: 'app', INSTAGRAM_APP_SECRET: 'secret', INSTAGRAM_REDIRECT_URI: 'https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback', JWT_SECRET: 'j'.repeat(40) });
    const accounts = { find: jest.fn().mockResolvedValue([]), create: jest.fn(input => input), save: jest.fn() };
    const service = new InstagramService(config, accounts as unknown as Repository<SocialAccount>, {} as Repository<LiveSession>, {} as LiveSaleService);
    const state = new URL(service.getOAuthUrl('owner').url).searchParams.get('state')!;
    const fetcher = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{"access_token":"short","user_id":17841465181379074}'))
      .mockResolvedValueOnce(new Response('{"access_token":"long","expires_in":3600}'))
      .mockResolvedValueOnce(new Response('{"id":"17841465181379074","username":"test-shop"}'))
      .mockResolvedValueOnce(new Response('{"success":true}'));
    const result = await service.completeOAuth('code', state);
    expect(String(fetcher.mock.calls[2][0])).toContain('/17841465181379074?');
    expect(accounts.save).toHaveBeenCalledWith(expect.objectContaining({ accountHandle: '@test-shop', metadata: expect.objectContaining({ instagramUserId: '17841465181379074' }) }));
    expect(result.webhookSubscribed).toBe(true);
  });
  it('requests supported Instagram Login permissions without an insights-only scope', () => {
    const config = new ConfigService({ INSTAGRAM_APP_ID: 'instagram-app', INSTAGRAM_REDIRECT_URI: 'https://api.kobeapptz.com/api/live-sales/instagram/oauth/callback', JWT_SECRET: 'j'.repeat(40), INSTAGRAM_OAUTH_SCOPES: 'instagram_business_manage_insights' });
    const service = new InstagramService(config, {} as Repository<SocialAccount>, {} as Repository<LiveSession>, {} as LiveSaleService);
    const scopes = new URL(service.getOAuthUrl('owner').url).searchParams.get('scope')?.split(',');
    expect(scopes).toEqual(expect.arrayContaining(['instagram_business_basic', 'instagram_business_manage_comments', 'instagram_business_manage_messages', 'instagram_business_content_publish']));
    expect(scopes).not.toContain('instagram_business_manage_insights');
  });
  it.each(['http://shop.kobeapptz.com/api/live-sales/ingest/' + 'a'.repeat(24), 'https://kobeapptz.com.evil.test/api/live-sales/ingest/' + 'a'.repeat(24), 'https://127.0.0.1/api/live-sales/ingest/' + 'a'.repeat(24), 'https://shop.kobeapptz.com/api/health'])('rejects unsafe relay target %s', url => {
    expect(() => relayTarget(url)).toThrow();
  });
  it('allows a published store capability URL', () => {
    const url = 'https://shop.kobeapptz.com/api/live-sales/ingest/' + 'a'.repeat(24);
    expect(relayTarget(url)).toBe(url);
  });
  it('ignores post comments during a phone live and privately replies to live reservations', async () => {
    const account = { id: 'account', ownerId: 'owner', platform: 'instagram', status: 'connected', accessToken: 'test-token', metadata: { instagramUserId: 'ig-id', webhookSubscribed: true } };
    const accounts = { find: jest.fn().mockResolvedValue([account]), save: jest.fn() };
    const sessions = { find: jest.fn().mockResolvedValue([{ id: 'session', kind: 'live' }]) };
    const sales = { ingestComment: jest.fn().mockResolvedValue({ reply: 'Private checkout URL' }) };
    const service = new InstagramService(new ConfigService({ INSTAGRAM_APP_SECRET: 'test-secret' }), accounts as unknown as Repository<SocialAccount>, sessions as unknown as Repository<LiveSession>, sales as unknown as LiveSaleService);
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const body = { entry: [{ id: 'ig-id', changes: [{ field: 'comments', value: { id: 'post-comment', text: 'A1' } }, { field: 'live_comments', value: { id: 'live-comment', text: 'A1 x2', from: { username: 'buyer' } } }] }] };
    const raw = Buffer.from(JSON.stringify(body));
    const result = await service.handleWebhook(body, raw, 'sha256=' + createHmac('sha256', 'test-secret').update(raw).digest('hex'));
    expect(result.ingested).toBe(1);
    expect(sales.ingestComment).toHaveBeenCalledWith('owner', 'session', expect.objectContaining({ externalId: 'live-comment', text: 'A1 x2' }));
    expect(fetcher.mock.calls[0][0]).toMatch(/ig-id\/messages$/);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({ recipient: { comment_id: 'live-comment' }, message: { text: 'Private checkout URL' } });
  });
  it('routes each regular post by its own media permalink and sends the correct reply type', async () => {
    const account = { id: 'account', ownerId: 'owner', accountHandle: '@shop', platform: 'instagram', status: 'connected', accessToken: 'token', metadata: { instagramUserId: 'ig-id' } };
    const accounts = { find: jest.fn().mockResolvedValue([account]) };
    const sessions = { find: jest.fn().mockResolvedValue([
      { id: 'newest', kind: 'post', postUrl: 'https://www.instagram.com/p/NEW/' },
      { id: 'shirts', kind: 'post', postUrl: 'https://www.instagram.com/p/SHIRTS/?igsh=tracking' },
    ]) };
    const sales = { ingestComment: jest.fn().mockResolvedValueOnce({ status: 'NEW', reply: 'public quote', publicReply: 'public quote' })
      .mockResolvedValueOnce({ status: 'RESERVED', reply: 'private checkout', publicReply: 'public shop' }) };
    const service = new InstagramService(new ConfigService({ INSTAGRAM_APP_SECRET: 'test-secret' }), accounts as unknown as Repository<SocialAccount>, sessions as unknown as Repository<LiveSession>, sales as unknown as LiveSaleService);
    const fetcher = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('{"permalink":"https://instagram.com/p/SHIRTS/"}'))
      .mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{"permalink":"https://instagram.com/p/UNKNOWN/"}'));
    const comment = (id: string, media: string, username: string, text: string) => ({
      field: 'comments', value: { id, text, media: { id: media }, from: { id: username, username } },
    });
    const body = { entry: [{ id: 'ig-id', changes: [
      comment('price', '1234', 'buyer', 'Bei gani?'), comment('buy', '1234', 'buyer', 'Nataka moja'),
      comment('own', '1234', 'shop', 'How much?'), comment('other-post', '9999', 'buyer', 'How much?'),
    ] }] };
    const raw = Buffer.from(JSON.stringify(body));
    expect(await service.handleWebhook(body, raw, 'sha256=' + createHmac('sha256', 'test-secret').update(raw).digest('hex'))).toEqual({ ok: true, ingested: 2 });
    expect(sales.ingestComment.mock.calls.map(args => args[1])).toEqual(['shirts', 'shirts']);
    expect(String(fetcher.mock.calls[1][0])).toMatch(/price\/replies$/);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ message: 'public quote' });
    expect(String(fetcher.mock.calls[2][0])).toMatch(/ig-id\/messages$/);
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({ recipient: { comment_id: 'buy' }, message: { text: 'private checkout' } });
  });

});
