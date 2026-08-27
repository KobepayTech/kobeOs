import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

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
    expect(go.headers.location).toBe('https://coca-cola.co.tz/live-offer');

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
});
