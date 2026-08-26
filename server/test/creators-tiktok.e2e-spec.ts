import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * TikTok connection surfaces on the creator profile via the shared social OAuth
 * store. Before any account is linked, the connection state must read
 * DISCONNECTED — never a stale "verified" — and syncing must be refused.
 */
describe('Creator TikTok connection (e2e)', () => {
  let app: INestApplication;
  let http: import('http').Server;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('reports DISCONNECTED and refuses sync until TikTok is connected', async () => {
    const reg = await request(http).post('/api/auth/register').send({ email: `c_${Date.now()}@test.io`, password: 'secret123' });
    const token = reg.body.accessToken as string;

    const creator = await request(http).post('/api/creators').set(auth(token)).send({ name: 'Amina Hassan', handle: 'amina' });
    expect(creator.status).toBe(201);
    const id = creator.body.id as string;

    const conn = await request(http).get(`/api/creators/${id}/tiktok/connection`).set(auth(token));
    expect(conn.status).toBe(200);
    expect(conn.body).toEqual({ platform: 'tiktok', state: 'DISCONNECTED' });

    // Sync must fail loudly rather than fabricate verified stats.
    const sync = await request(http).post(`/api/creators/${id}/tiktok/sync`).set(auth(token)).send({});
    expect(sync.status).toBe(400);
  });
});
