import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { bootTestApp, resetDb } from './setup';

/**
 * Creator Phase 3 — content deliverables: a creator attaches/publishes campaign
 * content, the brand verifies it, and removing it inside the live window is a
 * breach. Also proves the offer-response authorization fix (offer.creatorId is a
 * Creator id; the caller must own that Creator profile).
 */
describe('Creator content deliverables (e2e)', () => {
  let app: INestApplication;
  let http: import('http').Server;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const reg = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('runs accept → attach → verify → publish-gated → removed(breach)', async () => {
    const brand = await reg(`brand_${Date.now()}@test.io`);
    const creatorToken = await reg(`creator_${Date.now()}@test.io`);

    // Creator owns a Creator profile.
    const creator = await request(http).post('/api/creators').set(auth(creatorToken)).send({ name: 'Amina', handle: 'amina' });
    expect(creator.status).toBe(201);
    const creatorId = creator.body.id as string;

    // Brand runs a product-linked campaign (opens immediately) and offers it.
    const campaign = await request(http).post('/api/creators/campaigns/from-product').set(auth(brand))
      .send({ productId: randomUUID(), productName: 'Damage Jeans', productPrice: 35000, commissionPercent: 5 });
    const campaignId = campaign.body.id as string;
    const offerRes = await request(http).post(`/api/creators/campaigns/${campaignId}/offers`).set(auth(brand))
      .send({ creatorId, amountTzs: 150000 });
    expect(offerRes.status).toBe(201);
    const offerId = offerRes.body.offers[0].id as string;

    // A stranger cannot respond to the offer.
    const stranger = await reg(`stranger_${Date.now()}@test.io`);
    const bad = await request(http).post(`/api/creators/campaigns/${campaignId}/offers/${offerId}/respond`).set(auth(stranger)).send({ response: 'accepted' });
    expect(bad.status).toBe(403);

    // The real creator accepts (authorization fix: owns the Creator profile).
    const accept = await request(http).post(`/api/creators/campaigns/${campaignId}/offers/${offerId}/respond`).set(auth(creatorToken)).send({ response: 'accepted' });
    expect(accept.status).toBe(201);
    expect(accept.body.offers[0].status).toBe('active');

    // Creator attaches an existing TikTok post as the deliverable (7-day live).
    const attach = await request(http).post(`/api/creators/campaigns/${campaignId}/offers/${offerId}/attach-media`).set(auth(creatorToken))
      .send({ platform: 'tiktok', mediaId: 'v_abc123', url: 'https://tiktok.com/@amina/video/abc123', liveDays: 7 });
    expect(attach.status).toBe(201);
    expect(attach.body.offers[0].publishStatus).toBe('PUBLISHED');
    expect(attach.body.offers[0].publishedMediaId).toBe('v_abc123');

    // Live TikTok posting is gated off in this deployment.
    const publish = await request(http).post(`/api/creators/campaigns/${campaignId}/offers/${offerId}/publish-tiktok`).set(auth(creatorToken))
      .send({ mediaUrls: ['https://cdn/x.mp4'] });
    expect(publish.status).toBe(400);

    // Brand verifies the published deliverable.
    const verify = await request(http).post(`/api/creators/campaigns/${campaignId}/offers/${offerId}/verify-content`).set(auth(brand)).send({});
    expect(verify.status).toBe(201);
    expect(verify.body.offers[0].publishStatus).toBe('PUBLISHED_VERIFIED');

    // Removing it inside the 7-day window is a breach.
    const removed = await request(http).post(`/api/creators/campaigns/${campaignId}/offers/${offerId}/removed`).set(auth(brand)).send({});
    expect(removed.status).toBe(201);
    expect(removed.body.breach).toBe(true);
    expect(removed.body.campaign.offers[0].publishStatus).toBe('REMOVED');
  });
});
