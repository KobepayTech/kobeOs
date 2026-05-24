import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Coverage for the modules added on top of the original schema (print, admin,
 * devops, erp + the /erp/summary aggregation), plus the cross-cutting
 * per-user ownership guarantee that all of them inherit from OwnedCrudService.
 */
describe('New modules + ownership (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const token = async (email: string): Promise<string> => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    return r.body.accessToken as string;
  };
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('CRUD round-trips across print / admin / devops / erp', async () => {
    const t = await token('crud@e2e.test');

    const job = await request(http).post('/api/print/jobs').set(bearer(t))
      .send({ product: 'Corporate Polo', customer: 'CRDB', qty: 25, priority: 'High' });
    expect(job.status).toBe(201);
    expect(job.body.status).toBe('Pending'); // server default

    const patched = await request(http).patch(`/api/print/jobs/${job.body.id}`).set(bearer(t))
      .send({ status: 'Completed' });
    expect(patched.body.status).toBe('Completed');

    const company = await request(http).post('/api/admin/companies').set(bearer(t))
      .send({ name: 'Acme', plan: 'Pro', revenue: 1000 });
    expect(company.status).toBe(201);

    const list = await request(http).get('/api/admin/companies').set(bearer(t));
    expect(list.body).toHaveLength(1);

    const del = await request(http).delete(`/api/print/jobs/${job.body.id}`).set(bearer(t));
    expect(del.status).toBe(200);
    expect((await request(http).get('/api/print/jobs').set(bearer(t))).body).toHaveLength(0);
  });

  it('persists nested JSON: devops issue comments & erp PO items', async () => {
    const t = await token('nested@e2e.test');

    const issue = await request(http).post('/api/devops/issues').set(bearer(t))
      .send({ title: 'API timeout', priority: 'High', comments: [{ author: 'Rajab', text: 'investigating', date: '2026-01-01' }] });
    expect(issue.status).toBe(201);
    expect(issue.body.comments[0].text).toBe('investigating');

    const po = await request(http).post('/api/erp/purchase-orders').set(bearer(t))
      .send({ poNumber: 'PO-1', supplier: 'China Co', items: [{ name: 'Widget', qty: 2, price: 25000 }] });
    expect(po.status).toBe(201);
    expect(po.body.items[0].qty).toBe(2);

    // survives a re-fetch (round-trips through the DB column, not just the echo)
    const refetched = await request(http).get('/api/erp/purchase-orders').set(bearer(t));
    expect(refetched.body[0].items[0].name).toBe('Widget');
  });

  it('enforces per-user ownership isolation', async () => {
    const a = await token('owner-a@e2e.test');
    const b = await token('owner-b@e2e.test');

    const mine = await request(http).post('/api/print/jobs').set(bearer(a)).send({ product: 'Secret Job' });
    const id = mine.body.id as string;

    // B cannot see A's row
    const bList = await request(http).get('/api/print/jobs').set(bearer(b));
    expect(bList.body).toHaveLength(0);

    // B cannot mutate or delete A's row -> 404 (not 403, to avoid leaking existence)
    expect((await request(http).patch(`/api/print/jobs/${id}`).set(bearer(b)).send({ status: 'Completed' })).status).toBe(404);
    expect((await request(http).delete(`/api/print/jobs/${id}`).set(bearer(b))).status).toBe(404);

    // A is unaffected
    expect((await request(http).get('/api/print/jobs').set(bearer(a))).body).toHaveLength(1);
  });

  it('/erp/summary aggregates the caller\'s POS data', async () => {
    const t = await token('summary@e2e.test');
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'S1', name: 'Item', price: 1000, stock: 10 });
    await request(http).post('/api/pos/orders').set(bearer(t))
      .send({ orderNumber: 'O1', lines: [{ productId: product.body.id, quantity: 3 }] });

    const summary = await request(http).get('/api/erp/summary').set(bearer(t));
    expect(summary.status).toBe(200);
    expect(summary.body.kpis.revenue).toBe(3000);
    expect(summary.body.kpis.orders).toBe(1);
    expect(summary.body.accounts.monthlyTrend).toHaveLength(6);
  });

  it('rejects unauthenticated access to owned resources', async () => {
    expect((await request(http).get('/api/print/jobs')).status).toBe(401);
    expect((await request(http).get('/api/erp/summary')).status).toBe(401);
  });

  it('validates input (negative qty rejected)', async () => {
    const t = await token('validate@e2e.test');
    const bad = await request(http).post('/api/print/jobs').set(bearer(t)).send({ product: 'X', qty: -5 });
    expect(bad.status).toBe(400);
  });
});
