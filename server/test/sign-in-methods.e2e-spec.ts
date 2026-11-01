import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * What the login screen is told it can offer.
 *
 * The browser used to decide this from VITE_GOOGLE_CLIENT_ID, baked into the
 * bundle at build time. Configuring the server could therefore never light up
 * the Google button, the two could disagree about which client id, and the
 * button rendered regardless — so people clicked something that could not
 * work. The server verifies the credential, so the server answers.
 */
describe('Sign-in methods (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const GOOGLE = '1234567890-abcdefghijklmnop.apps.googleusercontent.com';

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = GOOGLE;
    process.env.TIKTOK_CLIENT_KEY = 'tiktok-key';
    process.env.TIKTOK_REDIRECT_URI = 'https://kobeapptz.com/oauth/tiktok';
    process.env.TIKTOK_CLIENT_SECRET = 'tiktok-secret-value';
    app = await bootTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_REDIRECT_URI;
    delete process.env.TIKTOK_CLIENT_SECRET;
  });

  beforeEach(async () => { await resetDb(app); });

  const methods = async () => {
    const res = await request(http).get('/api/auth/sign-in-methods');
    expect(res.status).toBe(200);
    return res.body as Record<string, any>;
  };

  it('needs no authentication, since nobody is signed in yet', async () => {
    const res = await request(http).get('/api/auth/sign-in-methods');
    expect(res.status).toBe(200);
  });

  it('always offers email and password, which need no configuration', async () => {
    expect((await methods()).password).toBe(true);
  });

  it('reports Google as available and hands back the client id to initialise with', async () => {
    // The same id the server will verify against, so the two cannot disagree.
    expect((await methods()).google).toEqual({ enabled: true, clientId: GOOGLE });
  });

  it('reports TikTok from its configuration', async () => {
    expect((await methods()).tiktok).toEqual({ enabled: true });
  });

  it('reports Meta as unavailable when nothing configures it', async () => {
    // Unconfigured must read as unavailable rather than erroring: the login
    // screen asks this before it can show anything at all.
    expect((await methods()).meta).toEqual({ enabled: false });
  });

  it('never returns a provider secret', async () => {
    // Client ids are published in the page by design; the secrets beside them
    // are not, and this endpoint is public.
    const payload = JSON.stringify(await methods());
    expect(payload).not.toContain('tiktok-secret-value');
    expect(payload).not.toMatch(/SECRET|SECRET_KEY|clientSecret|appSecret/i);
  });

  it('matches what the Google sign-in route actually enforces', async () => {
    // If these disagree the UI offers a button the API refuses, which is the
    // bug this endpoint exists to prevent.
    const reported = (await methods()).google.enabled;
    const res = await request(http).post('/api/auth/oauth/google')
      .send({ credential: 'not-a-real-credential' });

    // Configured: the route gets as far as rejecting the credential itself.
    // Unconfigured: it refuses with "not configured" instead.
    const refusedAsUnconfigured = /not configured/i.test(res.body?.message ?? '');
    expect(reported).toBe(!refusedAsUnconfigured);
  });
});
