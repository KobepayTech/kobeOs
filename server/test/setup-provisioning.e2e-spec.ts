import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { AiScheduledAgent } from '../src/ai/scheduled-agent.entity';
import { AppEntitlement } from '../src/app-marketplace/app-entitlement.entity';

/**
 * Turning the setup interview into a working business.
 *
 * The interview already asked what the business is. These tests cover what
 * happens next: a plan the owner reads, and then only the parts they ticked.
 */
describe('Guided setup provisioning (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let ds: DataSource;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    ds = app.get(DataSource);
  }, 180_000);
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { await resetDb(app); });

  const signUp = async (email: string) => {
    const res = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(res.status).toBe(201);
    return { token: res.body.accessToken as string, id: res.body.user.id as string };
  };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const SHOP = {
    businessType: 'shop',
    businessName: 'Mama Asha Duka',
    timezone: 'Africa/Dar_es_Salaam',
    currency: 'TZS',
    services: ['Deliveries around town'],
  };

  describe('the plan', () => {
    it('proposes a workspace for the business that was described', async () => {
      const me = await signUp('plan-shop@e2e.test');
      const res = await request(http).post('/api/onboarding/setup-plan')
        .set(auth(me.token)).send(SHOP);

      expect(res.status).toBe(201);
      expect(res.body.businessType).toBe('shop');
      expect(res.body.bundles.map((b: { bundleId: string }) => b.bundleId))
        .toEqual(['retail', 'logistics']);
      expect(res.body.automations.map((a: { key: string }) => a.key))
        .toEqual(['daily-sales-summary', 'low-stock-morning']);
      expect(res.body.timezone).toBe('Africa/Dar_es_Salaam');
    });

    it('explains every line, since the owner did not ask for the list', async () => {
      const me = await signUp('plan-why@e2e.test');
      const res = await request(http).post('/api/onboarding/setup-plan')
        .set(auth(me.token)).send(SHOP);

      for (const entry of [...res.body.bundles, ...res.body.automations]) {
        expect(entry.why.length).toBeGreaterThan(20);
      }
    });

    it('changes nothing, so an owner can look before deciding', async () => {
      const me = await signUp('plan-readonly@e2e.test');
      await request(http).post('/api/onboarding/setup-plan').set(auth(me.token)).send(SHOP);

      expect(await ds.getRepository(AppEntitlement).count({ where: { userId: me.id } })).toBe(0);
      expect(await ds.getRepository(AiScheduledAgent).count({ where: { ownerId: me.id } })).toBe(0);
    });

    it('asks for the interview to be finished rather than guessing', async () => {
      const me = await signUp('plan-empty@e2e.test');
      const res = await request(http).post('/api/onboarding/setup-plan')
        .set(auth(me.token)).send({ businessType: '' });

      expect(res.status).toBe(400);
    });

    it('needs authentication', async () => {
      expect((await request(http).post('/api/onboarding/setup-plan').send(SHOP)).status).toBe(401);
    });
  });

  describe('provisioning what was ticked', () => {
    it('installs the bundle and creates the automation', async () => {
      const me = await signUp('provision-both@e2e.test');
      const res = await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({ answers: SHOP, bundleIds: ['retail'], automationKeys: ['low-stock-morning'] });

      expect(res.status).toBe(201);
      expect(res.body.bundles).toEqual([
        { bundleId: 'retail', status: 'installed', error: '' },
      ]);
      expect(res.body.automations[0]).toMatchObject({
        key: 'low-stock-morning', name: 'Low stock before opening', status: 'created',
      });

      // The bundle really entitled apps, through the existing gate.
      const entitlements = await ds.getRepository(AppEntitlement).find({ where: { userId: me.id } });
      expect(entitlements.length).toBeGreaterThan(5);
      expect(entitlements.map((e) => e.appId)).toContain('erp-pos');

      const agents = await ds.getRepository(AiScheduledAgent).find({ where: { ownerId: me.id } });
      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({
        name: 'Low stock before opening', frequency: 'DAILY', timeOfDay: '07:00',
        timezone: 'Africa/Dar_es_Salaam', status: 'ACTIVE',
      });
    });

    it('creates agents that can only report, never act', async () => {
      // An agent switched on during setup, before the owner has seen what it
      // produces, must not be able to change stock, prices or bookings.
      const me = await signUp('provision-readonly@e2e.test');
      await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({ answers: SHOP, automationKeys: ['daily-sales-summary', 'low-stock-morning'] });

      const agents = await ds.getRepository(AiScheduledAgent).find({ where: { ownerId: me.id } });
      expect(agents).toHaveLength(2);
      for (const agent of agents) {
        expect(agent.allowedTools).toEqual([]);
        expect(agent.approvalMode).toBe('DRAFT_ONLY');
        expect(agent.outputDestination).toBe('KOBEOS_INBOX');
      }
    });

    it('does nothing when the owner ticked nothing', async () => {
      // Unticking the lot is an answer. Installing anyway would charge them
      // for declining.
      const me = await signUp('provision-none@e2e.test');
      const res = await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({ answers: SHOP });

      expect(res.status).toBe(201);
      expect(res.body.bundles).toEqual([]);
      expect(res.body.automations).toEqual([]);
      expect(await ds.getRepository(AppEntitlement).count({ where: { userId: me.id } })).toBe(0);
      expect(await ds.getRepository(AiScheduledAgent).count({ where: { ownerId: me.id } })).toBe(0);
    });

    it('ignores a choice the plan never offered', async () => {
      // A stale screen must not install something that is no longer proposed.
      const me = await signUp('provision-stale@e2e.test');
      const res = await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({ answers: SHOP, bundleIds: ['games'], automationKeys: ['make-me-coffee'] });

      expect(res.body.bundles).toEqual([]);
      expect(res.body.automations).toEqual([]);
      expect(await ds.getRepository(AppEntitlement).count({ where: { userId: me.id } })).toBe(0);
    });

    it('is idempotent, so a retried confirmation does not double anything', async () => {
      const me = await signUp('provision-twice@e2e.test');
      const body = { answers: SHOP, bundleIds: ['retail'], automationKeys: ['low-stock-morning'] };
      await request(http).post('/api/onboarding/provision').set(auth(me.token)).send(body);
      const second = await request(http).post('/api/onboarding/provision').set(auth(me.token)).send(body);

      expect(second.body.bundles[0].status).toBe('installed');
      const entitlements = await ds.getRepository(AppEntitlement).find({ where: { userId: me.id } });
      expect(entitlements.map((e) => e.appId).length).toBe(new Set(entitlements.map((e) => e.appId)).size);
      // The automation is created again rather than deduplicated, which the
      // owner can see and delete — but the paid part is not doubled.
      expect(second.body.automations[0].status).toBe('created');
    });

    it('sets a weekday for a weekly job, which the scheduler requires', async () => {
      const me = await signUp('provision-weekly@e2e.test');
      const res = await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({
          answers: { ...SHOP, businessType: 'restaurant', services: [] },
          automationKeys: ['menu-performance-weekly'],
        });

      expect(res.body.automations[0].status).toBe('created');
      const [agent] = await ds.getRepository(AiScheduledAgent).find({ where: { ownerId: me.id } });
      expect(agent.frequency).toBe('WEEKLY');
      expect(agent.daysOfWeek).toEqual([1]);
    });

    it('runs the jobs in the business timezone from the interview', async () => {
      // A wrong timezone delivers the morning stock list in the afternoon.
      const me = await signUp('provision-tz@e2e.test');
      await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({
          answers: { ...SHOP, timezone: 'Africa/Nairobi' },
          automationKeys: ['low-stock-morning'],
        });

      const [agent] = await ds.getRepository(AiScheduledAgent).find({ where: { ownerId: me.id } });
      expect(agent.timezone).toBe('Africa/Nairobi');
    });
  });

  describe('the other business kinds', () => {
    it('gives a hotel its arrivals job and the hospitality bundle', async () => {
      const me = await signUp('provision-hotel@e2e.test');
      const res = await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({
          answers: { businessType: 'hotel', businessName: 'Bahari Lodge', timezone: 'Africa/Dar_es_Salaam' },
          bundleIds: ['hospitality'], automationKeys: ['occupancy-morning'],
        });

      expect(res.body.bundles[0]).toMatchObject({ bundleId: 'hospitality', status: 'installed' });
      const entitlements = await ds.getRepository(AppEntitlement).find({ where: { userId: me.id } });
      expect(entitlements.map((e) => e.appId)).toContain('kobe-hotel');

      const [agent] = await ds.getRepository(AiScheduledAgent).find({ where: { ownerId: me.id } });
      expect(agent.name).toBe('Occupancy and arrivals');
      expect(agent.allowedModules).toContain('hotel');
    });

    it('gives a business it has no category for something useful anyway', async () => {
      const me = await signUp('provision-other@e2e.test');
      const res = await request(http).post('/api/onboarding/setup-plan').set(auth(me.token))
        .send({ businessType: 'barber shop', businessName: 'Kinyozi' });

      expect(res.body.bundles.map((b: { bundleId: string }) => b.bundleId)).toEqual(['office']);
      expect(res.body.automations.map((a: { key: string }) => a.key)).toEqual(['business-health-weekly']);
    });
  });

  describe('partial failure', () => {
    it('keeps what worked when one piece cannot be provisioned', async () => {
      // A shop that gets its bundles but loses the connection before the
      // automations should keep the bundles and finish the rest.
      const me = await signUp('provision-partial@e2e.test');
      const res = await request(http).post('/api/onboarding/provision').set(auth(me.token))
        .send({
          answers: { ...SHOP, timezone: 'Not/AZone' },
          bundleIds: ['retail'], automationKeys: ['low-stock-morning'],
        });

      expect(res.body.bundles[0].status).toBe('installed');
      expect(res.body.automations[0].status).toBe('failed');
      expect(res.body.automations[0].error).toBeTruthy();
      // The bundle survived, so the owner is not starting over.
      expect(await ds.getRepository(AppEntitlement).count({ where: { userId: me.id } }))
        .toBeGreaterThan(0);
    });
  });
});
