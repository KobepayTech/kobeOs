import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { bootTestApp, resetDb } from './setup';

/**
 * The creator-commerce attribution spine end-to-end:
 * merchant product → creator link → click → Jumla order → PENDING commission →
 * order completed → EARNED; a second order cancelled → REVERSED.
 */
describe('Creator commerce attribution (e2e)', () => {
  let app: INestApplication;
  let http: import('http').Server;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('attributes a Jumla sale to a creator and moves the commission PENDING→EARNED, and REVERSED on cancel', async () => {
    const token = await register(`merch_${Date.now()}@test.io`);
    const creatorId = randomUUID();

    // Merchant + product + online node so the product is orderable on Jumla.
    const biz = await request(http).post('/api/commerce/businesses').set(auth(token)).send({ name: 'Mlowe Quality Jeans' });
    expect(biz.status).toBe(201);
    const qa = await request(http).post('/api/commerce/products/quick-add').set(auth(token))
      .send({ imageUrl: 'https://example.com/jeans.jpg', name: 'Damage Jeans', price: 35000, stock: 20 });
    expect(qa.status).toBe(201);
    const productId = qa.body.products[0].id as string;
    await request(http).post('/api/commerce/nodes/register').set(auth(token)).send({}).expect(201);

    // "Promote With Creators" → product-linked campaign (references the real id).
    const campaign = await request(http).post('/api/creators/campaigns/from-product').set(auth(token))
      .send({ productId, productName: 'Damage Jeans', productPrice: 35000, commissionPercent: 5 });
    expect(campaign.status).toBe(201);
    expect(campaign.body.productId).toBe(productId);
    expect(campaign.body.status).toBe('open');

    // Attribution link for the creator.
    const link = await request(http).post('/api/creator-commerce/links').set(auth(token))
      .send({ creatorId, campaignId: campaign.body.id, productId, destinationUrl: '/jumla', commissionPercent: 5 });
    expect(link.status).toBe(201);
    const code = link.body.code as string;
    expect(code).toHaveLength(6);

    // Public "creator pick" info (drives the Jumla banner) resolves without a
    // redirect and never leaks owner/token data.
    const pick = await request(http).get(`/api/c/${code}/info`);
    expect(pick.status).toBe(200);
    expect(pick.body.code).toBe(code);
    expect(pick.body.productId).toBe(productId);
    expect(pick.body).not.toHaveProperty('ownerId');

    // Public click → 302 redirect carrying kc + kcid.
    const click = await request(http).get(`/api/c/${code}`).redirects(0);
    expect(click.status).toBe(302);
    expect(click.headers.location).toContain(`kc=${code}`);
    const clickId = new URL(click.headers.location, 'http://x').searchParams.get('kcid')!;
    expect(clickId).toBeTruthy();

    // Jumla order carrying the attribution → 2 × 35,000 = 70,000; commission 5% = 3,500.
    const order1 = await request(http).post('/api/commerce-public/jumla/orders').send({
      customer: { name: 'Amina', phone: '+255700000001' }, fulfillment: 'PICKUP',
      lines: [{ productId, quantity: 2 }], attribution: { code, clickId },
    });
    expect(order1.status).toBe(201);
    expect(order1.body.success).toBe(true);

    // A PENDING commission now exists for the creator.
    let comms = await request(http).get(`/api/creator-commerce/creators/${creatorId}/commissions`).set(auth(token));
    expect(comms.status).toBe(200);
    expect(comms.body.commissions).toHaveLength(1);
    const commission = comms.body.commissions[0];
    expect(commission.state).toBe('PENDING');
    expect(Number(commission.baseAmount)).toBe(70000);
    expect(Number(commission.rate)).toBe(5);
    expect(Number(commission.amount)).toBe(3500);

    // Merchant completes the order → commission EARNED.
    const orders = await request(http).get('/api/commerce/orders').set(auth(token));
    const merchantOrderId = orders.body.orders[0].id as string;
    await request(http).patch(`/api/commerce/orders/${merchantOrderId}/status`).set(auth(token)).send({ status: 'COMPLETED' }).expect(200);

    comms = await request(http).get(`/api/creator-commerce/creators/${creatorId}/commissions`).set(auth(token));
    expect(comms.body.commissions.find((c: { orderId: string }) => c.orderId === merchantOrderId).state).toBe('EARNED');

    // A second attributed order that gets cancelled → REVERSED (no commission owed).
    const order2 = await request(http).post('/api/commerce-public/jumla/orders').send({
      customer: { name: 'Bob', phone: '+255700000002' }, fulfillment: 'PICKUP',
      lines: [{ productId, quantity: 1 }], attribution: { code, clickId },
    });
    expect(order2.status).toBe(201);
    const orders2 = await request(http).get('/api/commerce/orders').set(auth(token));
    const secondOrderId = (orders2.body.orders as Array<{ id: string; total: string }>).find((o) => Number(o.total) === 35000)!.id;
    await request(http).patch(`/api/commerce/orders/${secondOrderId}/status`).set(auth(token)).send({ status: 'CANCELLED' }).expect(200);

    comms = await request(http).get(`/api/creator-commerce/creators/${creatorId}/commissions`).set(auth(token));
    expect(comms.body.commissions.find((c: { orderId: string }) => c.orderId === secondOrderId).state).toBe('REVERSED');

    // Campaign performance rollup reflects the one non-reversed sale.
    const perf = await request(http).get(`/api/creator-commerce/campaigns/${campaign.body.id}/performance`).set(auth(token));
    expect(perf.status).toBe(200);
    expect(perf.body.orders).toBe(1);
    expect(Number(perf.body.revenue)).toBe(70000);
    expect(Number(perf.body.commissionOwed)).toBe(3500);
  });
});
