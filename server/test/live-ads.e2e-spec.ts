import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';
import { LiveAdsService } from '../src/live-ads/live-ads.service';

/**
 * Kobe Live Ads — the permanent-link performance-ad flow end to end:
 * identity → approved destination → admin-approved campaign → go live → slot →
 * bio link resolves the current sponsor → CTA click 302s to the server-side URL
 * → QR gives exact attribution → sponsor changes behind the SAME link →
 * emergency-stop falls back safely → creator scorecard.
 */
describe('Kobe Live Ads (e2e)', () => {
  let app: INestApplication;
  let http: import('http').Server;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const register = async (email: string, role: 'user' | 'admin' = 'user') => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    if (role === 'user') return r.body.accessToken as string;
    await app.get(DataSource).query('UPDATE "users" SET "role" = $1 WHERE "email" = $2', [role, email]);
    const login = await request(http).post('/api/auth/login').send({ email, password: 'secret123' });
    return login.body.accessToken as string;
  };

  it('runs the full permanent-link sponsorship lifecycle', async () => {
    const brayo = await register(`brayo_${Date.now()}@test.io`);       // creator
    const advertiser = await register(`brand_${Date.now()}@test.io`);  // Coca-Cola / Samsung
    const admin = await register(`admin_${Date.now()}@test.io`, 'admin');

    // Creator identity + permanent link.
    const creator = await request(http).post('/api/creators').set(auth(brayo)).send({ name: 'Brayo', handle: 'brayo_gamertz' });
    const creatorId = creator.body.id as string;
    const identity = await request(http).post('/api/live-ads/identity').set(auth(brayo)).send({ creatorId });
    expect(identity.status).toBe(201);
    expect(identity.body.permanentUrl).toBe('/live/@brayo_gamertz');
    const overlayToken = identity.body.overlayToken as string;

    // Before going live, the bio link is just the creator page.
    let bio = await request(http).get('/api/live/resolve/brayo_gamertz');
    expect(bio.body.mode).toBe('CREATOR_PAGE');
    expect(bio.body.live).toBe(false);

    // Advertiser: server-side approved destination + a campaign, admin-approved.
    const dest = await request(http).post('/api/live-ads/destinations').set(auth(advertiser)).send({ url: 'https://coca-cola.co.tz/live-offer' });
    expect(dest.status).toBe(201);
    const cola = await request(http).post('/api/live-ads/campaigns').set(auth(advertiser)).send({
      title: 'Coca-Cola LIVE', sponsorName: 'Coca-Cola', destinationId: dest.body.id,
      routingMode: 'SPONSOR_PAGE', offerText: 'Special LIVE offer', couponCode: 'MARIAM20',
      pricePerSlot: 50000, costPerClick: 200, creatorSharePercent: 70,
    });
    await request(http).post(`/api/live-ads/campaigns/${cola.body.id}/submit`).set(auth(advertiser)).expect(201);
    // A non-admin cannot approve.
    await request(http).post(`/api/live-ads/campaigns/${cola.body.id}/approve`).set(auth(advertiser)).send({}).expect(403);
    await request(http).post(`/api/live-ads/campaigns/${cola.body.id}/approve`).set(auth(admin)).send({}).expect(201);

    // Overlay connects → creator is live (Kobe-detected, not TikTok).
    await request(http).post(`/api/live/overlay/${overlayToken}/heartbeat`).expect(201);

    // Start the Coca-Cola slot: 10s creative, 15-min CTA window.
    const slot = await request(http).post('/api/live-ads/slots').set(auth(brayo)).send({ creatorId, campaignId: cola.body.id, playbackSeconds: 10, ctaSeconds: 900 });
    expect(slot.status).toBe(201);
    const qrCode = (slot.body.qr as string).split('/').pop()!;
    await request(http).post(`/api/live/overlay/${overlayToken}/impression`).send({ slotId: slot.body.slot.id }).expect(201);

    // The SAME bio link now opens Coca-Cola's sponsor page.
    bio = await request(http).get('/api/live/resolve/brayo_gamertz');
    expect(bio.body.mode).toBe('SPONSOR_PAGE');
    expect(bio.body.sponsor.name).toBe('Coca-Cola');
    expect(bio.body.sponsor.couponCode).toBe('MARIAM20');
    const clickVisitId = bio.body.clickVisitId as string;

    // Click-through 302s to the server-side approved URL (never client-supplied).
    const go = await request(http).get(`/api/live/go/${clickVisitId}`).redirects(0);
    expect(go.status).toBe(302);
    expect(go.headers.location).toContain('https://coca-cola.co.tz/live-offer'); // + ?klv attribution

    // Slot-exact QR → precise attribution to this sponsor.
    const qr = await request(http).get(`/api/live/a/${qrCode}`);
    expect(qr.body.mode).toBe('SPONSOR_PAGE');
    expect(qr.body.sponsor.name).toBe('Coca-Cola');

    // Sponsor changes behind the SAME permanent link: Samsung takes over.
    const dest2 = await request(http).post('/api/live-ads/destinations').set(auth(advertiser)).send({ url: 'https://samsung.co.tz/live' });
    const samsung = await request(http).post('/api/live-ads/campaigns').set(auth(advertiser)).send({ title: 'Samsung LIVE', sponsorName: 'Samsung', destinationId: dest2.body.id, offerText: 'Galaxy deal', couponCode: 'GALAXY10', pricePerSlot: 60000, costPerClick: 300 });
    await request(http).post(`/api/live-ads/campaigns/${samsung.body.id}/submit`).set(auth(advertiser)).expect(201);
    await request(http).post(`/api/live-ads/campaigns/${samsung.body.id}/approve`).set(auth(admin)).send({}).expect(201);
    await request(http).post('/api/live-ads/slots').set(auth(brayo)).send({ creatorId, campaignId: samsung.body.id, playbackSeconds: 10, ctaSeconds: 900 }).expect(201);

    bio = await request(http).get('/api/live/resolve/brayo_gamertz');
    expect(bio.body.sponsor.name).toBe('Samsung'); // same URL, new sponsor

    // Admin emergency-stop kills routing without touching the bio link.
    await request(http).post(`/api/live-ads/campaigns/${samsung.body.id}/emergency-stop`).set(auth(admin)).expect(201);
    bio = await request(http).get('/api/live/resolve/brayo_gamertz');
    expect(bio.body.mode).toBe('CREATOR_PAGE'); // safe fallback, still live
    expect(bio.body.live).toBe(true);

    // A disabled destination also blocks a click even mid-flight (open-redirect guard).
    // (Coca-Cola slot's ctaWindow is still open; disable its destination, then click.)
    await request(http).post(`/api/live-ads/destinations/${dest.body.id}/disable`).set(auth(advertiser)).expect(201);
    const blocked = await request(http).get(`/api/live/go/${clickVisitId}`).redirects(0);
    expect(blocked.headers.location).toBe('/jumla'); // falls back, never the advertiser URL

    // Old handle keeps working after a rename (printed links never die).
    await request(http).post('/api/live-ads/identity/rename').set(auth(brayo)).send({ creatorId, handle: 'brayo_official' });
    const viaOld = await request(http).get('/api/live/resolve/brayo_gamertz');
    expect(viaOld.body.creator.handle).toBe('brayo_official');

    // Creator scorecard reflects the funnel.
    const stats = await request(http).get(`/api/live-ads/creators/${creatorId}/stats`).set(auth(brayo));
    expect(stats.body.impressions).toBeGreaterThanOrEqual(1);
    expect(stats.body.ctaClicks).toBeGreaterThanOrEqual(1);
    expect(Number(stats.body.creatorEarnings)).toBeGreaterThan(0);
  });

  it('auto-delivers ads on a rotation while the creator is live', async () => {
    const brayo = await register(`rot_${Date.now()}@test.io`);
    const advertiser = await register(`radv_${Date.now()}@test.io`);
    const admin = await register(`radm_${Date.now()}@test.io`, 'admin');

    const creator = await request(http).post('/api/creators').set(auth(brayo)).send({ name: 'Rot', handle: `rot${Date.now()}` });
    const creatorId = creator.body.id as string;
    const overlay = (await request(http).post('/api/live-ads/identity').set(auth(brayo)).send({ creatorId })).body.overlayToken as string;

    const dest = await request(http).post('/api/live-ads/destinations').set(auth(advertiser)).send({ url: 'https://sponsor.co.tz/x' });
    const camp = await request(http).post('/api/live-ads/campaigns').set(auth(advertiser)).send({ title: 'Rot', sponsorName: 'RotoCola', destinationId: dest.body.id, creativeFormat: 'FULLSCREEN', offerText: 'Deal' });
    await request(http).post(`/api/live-ads/campaigns/${camp.body.id}/submit`).set(auth(advertiser)).expect(201);
    await request(http).post(`/api/live-ads/campaigns/${camp.body.id}/approve`).set(auth(admin)).send({}).expect(201);

    // Configure auto-delivery and go live.
    await request(http).post(`/api/live-ads/creators/${creatorId}/rotation`).set(auth(brayo)).send({ campaignIds: [camp.body.id], everySeconds: 300, playbackSeconds: 10 }).expect(201);
    await request(http).post(`/api/live/overlay/${overlay}/heartbeat`).expect(201);

    // Drive the rotation tick directly (the cron calls this every 20s).
    const svc = app.get(LiveAdsService);
    expect(await svc.runRotationsOnce()).toBe(1);         // starts a sponsor slot
    expect(await svc.runRotationsOnce()).toBe(0);         // interval not elapsed → no duplicate

    // The bio link now serves the rotated sponsor, and the overlay knows the format.
    const bio = await request(http).get(`/api/live/resolve/${creator.body.handle}`);
    expect(bio.body.sponsor.name).toBe('RotoCola');
    const state = await request(http).get(`/api/live/overlay/${overlay}/state`);
    expect(state.body.slot.creativeFormat).toBe('FULLSCREEN');
  });

  it('pairs the Android app with a 6-digit code', async () => {
    const brayo = await register(`pair_${Date.now()}@test.io`);
    const creator = await request(http).post('/api/creators').set(auth(brayo)).send({ name: 'Pair', handle: `pair${Date.now()}` });
    const id = (await request(http).post('/api/live-ads/identity').set(auth(brayo)).send({ creatorId: creator.body.id })).body as { overlayToken: string };

    const pc = await request(http).post(`/api/live-ads/creators/${creator.body.id}/pair-code`).set(auth(brayo)).send({});
    expect(pc.status).toBe(201);
    expect(pc.body.code).toMatch(/^\d{6}$/);

    const redeem = await request(http).post('/api/live/pair').send({ code: pc.body.code });
    expect(redeem.status).toBe(201);
    expect(redeem.body.overlayToken).toBe(id.overlayToken); // app now holds the token

    // Single-use.
    await request(http).post('/api/live/pair').send({ code: pc.body.code }).expect(400);
  });

  it('attributes a Jumla sale back to the live sponsor (conversion loop)', async () => {
    const brayo = await register(`conv_${Date.now()}@test.io`);
    const advertiser = await register(`cadv_${Date.now()}@test.io`);
    const admin = await register(`cadm_${Date.now()}@test.io`, 'admin');

    const creator = await request(http).post('/api/creators').set(auth(brayo)).send({ name: 'Conv', handle: `conv${Date.now()}` });
    const creatorId = creator.body.id as string;
    const overlay = (await request(http).post('/api/live-ads/identity').set(auth(brayo)).send({ creatorId })).body.overlayToken as string;

    // Advertiser is also the merchant selling the product on Jumla.
    await request(http).post('/api/commerce/businesses').set(auth(advertiser)).send({ name: 'Sponsor Store' }).expect(201);
    const qa = await request(http).post('/api/commerce/products/quick-add').set(auth(advertiser)).send({ imageUrl: 'https://x/y.jpg', name: 'Energy Drink', price: 5000, stock: 100 });
    const productId = qa.body.products[0].id as string;
    await request(http).post('/api/commerce/nodes/register').set(auth(advertiser)).send({}).expect(201);

    const dest = await request(http).post('/api/live-ads/destinations').set(auth(advertiser)).send({ url: 'https://sponsor.example/jumla-product' });
    const camp = await request(http).post('/api/live-ads/campaigns').set(auth(advertiser)).send({ title: 'C', sponsorName: 'EnergyCo', destinationId: dest.body.id });
    await request(http).post(`/api/live-ads/campaigns/${camp.body.id}/submit`).set(auth(advertiser)).expect(201);
    await request(http).post(`/api/live-ads/campaigns/${camp.body.id}/approve`).set(auth(admin)).send({}).expect(201);

    await request(http).post(`/api/live/overlay/${overlay}/heartbeat`).expect(201);
    await request(http).post('/api/live-ads/slots').set(auth(brayo)).send({ creatorId, campaignId: camp.body.id }).expect(201);

    // Viewer taps the sponsor link → click-through carries klv to the destination.
    const bio = await request(http).get(`/api/live/resolve/${creator.body.handle}`);
    const go = await request(http).get(`/api/live/go/${bio.body.clickVisitId}`).redirects(0);
    const klv = new URL(go.headers.location).searchParams.get('klv')!;
    expect(klv).toBeTruthy();

    // The viewer then buys on Jumla, forwarding the live click id.
    const order = await request(http).post('/api/commerce-public/jumla/orders').send({
      customer: { name: 'Fan', phone: '+255700000123' }, fulfillment: 'PICKUP',
      lines: [{ productId, quantity: 4 }], attribution: { liveClickVisitId: klv },
    });
    expect(order.status).toBe(201);

    // The sponsor's scorecard now shows a real SALE, not just a click.
    const stats = await request(http).get(`/api/live-ads/campaigns/${camp.body.id}/stats`).set(auth(advertiser));
    expect(stats.body.conversions).toBe(1);
    expect(Number(stats.body.attributedRevenue)).toBe(20000); // 4 × 5000
  });
});
