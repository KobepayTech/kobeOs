import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { ContinuityService } from '../src/cloud-continuity/continuity.service';
import { CloudOutboxRecord } from '../src/cloud-continuity/continuity.entity';

/**
 * Sync backlog reporting on /api/health.
 *
 * It rides on this endpoint because everything that watches the system already
 * polls it — Electron boot, the frontend health hook, the Cloudflare tunnel —
 * so one external uptime check covers both liveness and whether online
 * transactions are reaching the main database.
 *
 * The release workflow asserts on this payload (status eq 'ok' and db eq
 * 'connected'), so the existing contract is pinned here too.
 */
describe('Sync health on /api/health (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let ds: DataSource;
  let continuity: ContinuityService;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    ds = app.get(DataSource);
    continuity = app.get(ContinuityService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return r.body.user.id as string;
  };

  /** Backdate an outbox row so lag can be exercised without waiting hours. */
  const backdate = async (id: string, ageMs: number) => {
    await ds.getRepository(CloudOutboxRecord).query(
      'UPDATE cloud_outbox SET "createdAt" = $2 WHERE id = $1',
      [id, new Date(Date.now() - ageMs)],
    );
  };

  it('keeps the health contract the release workflow asserts on', async () => {
    const res = await request(http).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
    expect(res.body.timestamp).toBeTruthy();
  });

  it('reports ok with an empty backlog', async () => {
    const res = await request(http).get('/api/health');
    expect(res.body.sync).toMatchObject({ status: 'ok', pending: 0 });
    expect(res.body.sync.oldestAgeSeconds).toBeNull();
  });

  it('counts a pending transaction without alarming while it is fresh', async () => {
    const owner = await register('sync-fresh@e2e.test');
    await continuity.recordOutbox(owner, 'BOOKING', 'sh-1', { any: 'thing' });

    const res = await request(http).get('/api/health');
    expect(res.body.sync.pending).toBe(1);
    expect(res.body.sync.status).toBe('ok');
    expect(res.body.sync.oldestAgeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('warns once the oldest unsynced transaction passes an hour', async () => {
    const owner = await register('sync-warn@e2e.test');
    const row = await continuity.recordOutbox(owner, 'BOOKING', 'sh-2', {});
    await backdate(row.id, 90 * 60 * 1000);

    const res = await request(http).get('/api/health');
    expect(res.body.sync.status).toBe('warn');
  });

  it('goes critical well before the cloud recovery window closes', async () => {
    const owner = await register('sync-critical@e2e.test');
    const row = await continuity.recordOutbox(owner, 'BOOKING', 'sh-3', {});
    await backdate(row.id, 5 * 60 * 60 * 1000);

    const res = await request(http).get('/api/health');
    expect(res.body.sync.status).toBe('critical');
    // And the API stays up: unsynced bookings are for an operator to chase,
    // not a reason to stop accepting the next one.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('clears once the backlog is synced', async () => {
    const owner = await register('sync-clear@e2e.test');
    const row = await continuity.recordOutbox(owner, 'BOOKING', 'sh-4', {});
    await backdate(row.id, 5 * 60 * 60 * 1000);
    expect((await request(http).get('/api/health')).body.sync.status).toBe('critical');

    await continuity.markSynced(owner, row.id);

    const res = await request(http).get('/api/health');
    expect(res.body.sync).toMatchObject({ status: 'ok', pending: 0 });
  });

  it('ignores synced rows however old they are', async () => {
    const owner = await register('sync-old@e2e.test');
    const row = await continuity.recordOutbox(owner, 'BOOKING', 'sh-5', {});
    await backdate(row.id, 30 * 24 * 60 * 60 * 1000);
    await continuity.markSynced(owner, row.id);

    const res = await request(http).get('/api/health');
    expect(res.body.sync.status).toBe('ok');
  });

  it('counts the backlog across owners, since one monitor watches the system', async () => {
    const a = await register('sync-a@e2e.test');
    const b = await register('sync-b@e2e.test');
    await continuity.recordOutbox(a, 'BOOKING', 'sh-a', {});
    await continuity.recordOutbox(b, 'ORDER', 'sh-b', {});

    const res = await request(http).get('/api/health');
    expect(res.body.sync.pending).toBe(2);
  });

  it('needs no authentication, so an uptime monitor can poll it', async () => {
    const res = await request(http).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.sync).toBeDefined();
  });
});
