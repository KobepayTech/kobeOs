import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { AppEntitlement } from '../src/app-marketplace/app-entitlement.entity';
import { appsForModule } from '../src/app-marketplace/module-entitlements.service';

/**
 * Bundle and module entitlements.
 *
 * These ride on the existing per-app gate rather than adding a second one, so
 * the tests check the grouping — claim once, deduplicate the overlap, report
 * per module — and that trials and expiry still come from where they always
 * did.
 */
describe('Module and bundle entitlements (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let ds: DataSource;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    ds = app.get(DataSource);
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { await resetDb(app); });

  const signUp = async (email: string) => {
    const res = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(res.status).toBe(201);
    return { token: res.body.accessToken as string, id: res.body.user.id as string };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('claiming a module', () => {
    it('entitles every app the module grants', async () => {
      const me = await signUp('mod-one@e2e.test');
      const res = await request(http).post('/api/app-marketplace/modules/kobe-hotel/install')
        .set(auth(me.token));

      expect(res.status).toBe(201);
      expect(res.body.moduleId).toBe('kobe-hotel');
      expect(res.body.name).toBe('Kobe Hotels');
      expect(res.body.apps.map((a: { appId: string }) => a.appId))
        .toEqual(appsForModule('kobe-hotel'));
    });

    it('starts the module on trial, from the existing gate', async () => {
      const me = await signUp('mod-trial@e2e.test');
      const res = await request(http).post('/api/app-marketplace/modules/kobe-games/install')
        .set(auth(me.token));

      expect(res.body.access).toBe('trial');
      expect(res.body.daysRemaining).toBeGreaterThan(0);
    });

    it('is idempotent, so claiming twice neither restarts a trial nor charges again', async () => {
      const me = await signUp('mod-twice@e2e.test');
      const first = await request(http).post('/api/app-marketplace/modules/kobe-games/install')
        .set(auth(me.token));
      const second = await request(http).post('/api/app-marketplace/modules/kobe-games/install')
        .set(auth(me.token));

      expect(second.status).toBe(201);
      const installedAt = (body: { apps: Array<{ installedAt: number }> }) =>
        body.apps.map((a) => a.installedAt);
      expect(installedAt(second.body)).toEqual(installedAt(first.body));

      const rows = await ds.getRepository(AppEntitlement).find({ where: { userId: me.id } });
      expect(rows).toHaveLength(appsForModule('kobe-games').length);
    });

    it('refuses an unknown module rather than entitling nothing and reporting success', async () => {
      const me = await signUp('mod-unknown@e2e.test');
      const res = await request(http).post('/api/app-marketplace/modules/kobe-nonsense/install')
        .set(auth(me.token));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown product module/i);
    });

    it('needs authentication', async () => {
      const res = await request(http).post('/api/app-marketplace/modules/kobe-games/install');
      expect(res.status).toBe(401);
    });
  });

  describe('claiming a bundle selection', () => {
    it('entitles every module the bundles need', async () => {
      const me = await signUp('bundle-one@e2e.test');
      const res = await request(http).post('/api/app-marketplace/bundles/install')
        .set(auth(me.token)).send({ bundleIds: ['hospitality'] });

      expect(res.status).toBe(201);
      const ids = res.body.modules.map((m: { moduleId: string }) => m.moduleId);
      expect(ids).toEqual(
        expect.arrayContaining(['kobe-hotel', 'kobe-commerce', 'kobe-accountant', 'kobe-connect']),
      );
    });

    it('claims a shared module once across overlapping bundles', async () => {
      // Retail and Hospitality both include Kobe Accountant. Claiming it per
      // bundle would restart its trial and, on a paid plan, charge twice.
      const me = await signUp('bundle-overlap@e2e.test');
      const res = await request(http).post('/api/app-marketplace/bundles/install')
        .set(auth(me.token)).send({ bundleIds: ['retail', 'hospitality'] });

      const ids = res.body.modules.map((m: { moduleId: string }) => m.moduleId);
      expect(ids.filter((id: string) => id === 'kobe-accountant')).toHaveLength(1);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('creates one entitlement row per app, not one per bundle that wanted it', async () => {
      const me = await signUp('bundle-rows@e2e.test');
      await request(http).post('/api/app-marketplace/bundles/install')
        .set(auth(me.token)).send({ bundleIds: ['retail', 'hospitality', 'restaurants'] });

      const rows = await ds.getRepository(AppEntitlement).find({ where: { userId: me.id } });
      const appIds = rows.map((row) => row.appId);
      expect(appIds.length).toBe(new Set(appIds).size);
    });

    it('refuses an unknown bundle', async () => {
      const me = await signUp('bundle-unknown@e2e.test');
      const res = await request(http).post('/api/app-marketplace/bundles/install')
        .set(auth(me.token)).send({ bundleIds: ['retail', 'not-a-bundle'] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown bundle/i);
    });

    it('rejects an empty selection', async () => {
      const me = await signUp('bundle-empty@e2e.test');
      const res = await request(http).post('/api/app-marketplace/bundles/install')
        .set(auth(me.token)).send({ bundleIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('reporting what a user has', () => {
    it('lists every module, with none owned reported as none', async () => {
      const me = await signUp('report-empty@e2e.test');
      const res = await request(http).get('/api/app-marketplace/modules').set(auth(me.token));

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(16);
      expect(res.body.every((m: { access: string }) => m.access === 'none')).toBe(true);
    });

    it('reports a claimed module as trial and the rest as none', async () => {
      const me = await signUp('report-one@e2e.test');
      await request(http).post('/api/app-marketplace/modules/kobe-games/install').set(auth(me.token));

      const res = await request(http).get('/api/app-marketplace/modules').set(auth(me.token));
      const games = res.body.find((m: { moduleId: string }) => m.moduleId === 'kobe-games');
      const hotel = res.body.find((m: { moduleId: string }) => m.moduleId === 'kobe-hotel');
      expect(games.access).toBe('trial');
      expect(hotel.access).toBe('none');
    });

    it('reports a partly claimed module as none, not as usable', async () => {
      // A module is only as entitled as its least-entitled app. Reporting the
      // best case would show it active while part of it is locked, and the
      // person would discover that by opening the app that does not work.
      const me = await signUp('report-partial@e2e.test');
      const [firstApp] = appsForModule('kobe-commerce');
      await request(http).post(`/api/app-marketplace/apps/${firstApp}/install`).set(auth(me.token));

      const res = await request(http).get('/api/app-marketplace/modules').set(auth(me.token));
      const commerce = res.body.find((m: { moduleId: string }) => m.moduleId === 'kobe-commerce');
      expect(commerce.access).toBe('none');
      expect(commerce.apps).toHaveLength(1);
    });

    it('reports the soonest expiry, since that is when the workspace breaks', async () => {
      const me = await signUp('report-expiry@e2e.test');
      await request(http).post('/api/app-marketplace/modules/kobe-games/install').set(auth(me.token));

      // Expire one app of the module by hand; the module must follow it down.
      const repo = ds.getRepository(AppEntitlement);
      const [one] = await repo.find({ where: { userId: me.id }, take: 1 });
      one.trialEndsAt = new Date(Date.now() - 1000);
      await repo.save(one);

      const res = await request(http).get('/api/app-marketplace/modules').set(auth(me.token));
      const games = res.body.find((m: { moduleId: string }) => m.moduleId === 'kobe-games');
      expect(games.access).toBe('expired');
      expect(games.daysRemaining).toBe(0);
    });

    it('keeps one user out of another user entitlements', async () => {
      const mine = await signUp('report-mine@e2e.test');
      const theirs = await signUp('report-theirs@e2e.test');
      await request(http).post('/api/app-marketplace/modules/kobe-games/install').set(auth(theirs.token));

      const res = await request(http).get('/api/app-marketplace/modules').set(auth(mine.token));
      expect(res.body.every((m: { access: string }) => m.access === 'none')).toBe(true);
    });
  });
});
