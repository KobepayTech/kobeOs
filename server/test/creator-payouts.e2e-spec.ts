import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Creator Phase 4: a promo code is a second attribution path (no click needed),
 * and earned commissions batch EARNED → PAYABLE → PAID with a payout record that
 * posts a marketing expense to Kobe Accountant.
 */
describe('Creator promo attribution + payouts (e2e)', () => {
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

  it('attributes an order by promo code, then batches and pays the commission', async () => {
    const token = await reg(`m_${Date.now()}@test.io`);

    // Merchant + product + online node.
    await request(http).post('/api/commerce/businesses').set(auth(token)).send({ name: 'Mlowe Jeans' }).expect(201);
    const qa = await request(http).post('/api/commerce/products/quick-add').set(auth(token))
      .send({ imageUrl: 'https://example.com/j.jpg', name: 'Damage Jeans', price: 20000, stock: 50 });
    const productId = qa.body.products[0].id as string;
    await request(http).post('/api/commerce/nodes/register').set(auth(token)).send({}).expect(201);

    // A creator profile + an attribution link carrying a promo code.
    const creator = await request(http).post('/api/creators').set(auth(token)).send({ name: 'Amina', handle: 'amina' });
    const creatorId = creator.body.id as string;
    const link = await request(http).post('/api/creator-commerce/links').set(auth(token))
      .send({ creatorId, productId, destinationUrl: '/jumla', commissionPercent: 10, promoCode: 'AMINA10' });
    expect(link.status).toBe(201);

    // Public checkout can validate the promo code → shows whose code it is.
    const promoInfo = await request(http).get('/api/c/promo/AMINA10');
    expect(promoInfo.status).toBe(200);
    expect(promoInfo.body.creator.handle).toBe('amina');

    // Order placed with ONLY the promo code (no click) → commission attributed.
    const order = await request(http).post('/api/commerce-public/jumla/orders').send({
      customer: { name: 'Buyer', phone: '+255700000009' }, fulfillment: 'PICKUP',
      lines: [{ productId, quantity: 3 }], attribution: { promoCode: 'AMINA10' },
    });
    expect(order.status).toBe(201);

    let comms = await request(http).get(`/api/creator-commerce/creators/${creatorId}/commissions`).set(auth(token));
    expect(comms.body.commissions).toHaveLength(1);
    const orderId = comms.body.commissions[0].orderId as string;
    expect(comms.body.commissions[0].state).toBe('PENDING');
    expect(Number(comms.body.commissions[0].amount)).toBe(6000); // 3×20000×10%

    // Complete → EARNED.
    const orders = await request(http).get('/api/commerce/orders').set(auth(token));
    const merchantOrderId = (orders.body.orders as Array<{ id: string }>)[0].id;
    await request(http).patch(`/api/commerce/orders/${merchantOrderId}/status`).set(auth(token)).send({ status: 'COMPLETED' }).expect(200);

    // Stage payable, then pay out.
    const payable = await request(http).post(`/api/creator-commerce/creators/${creatorId}/mark-payable`).set(auth(token)).send({});
    expect(payable.body.moved).toBe(1);

    const payout = await request(http).post(`/api/creator-commerce/creators/${creatorId}/payout`).set(auth(token)).send({});
    expect(payout.status).toBe(201);
    expect(Number(payout.body.amount)).toBe(6000);
    expect(payout.body.status).toBe('PAID');
    expect(payout.body.commissionCount).toBe(1);
    expect(payout.body.financialTransactionId).toBeTruthy(); // booked in Kobe Accountant

    // Commission is now PAID and the scorecard reflects the settled sale.
    comms = await request(http).get(`/api/creator-commerce/creators/${creatorId}/commissions`).set(auth(token));
    expect(comms.body.commissions.find((c: { orderId: string }) => c.orderId === orderId).state).toBe('PAID');

    const stats = await request(http).get(`/api/creator-commerce/creators/${creatorId}/stats`).set(auth(token));
    expect(Number(stats.body.revenue)).toBe(60000);
    expect(Number(stats.body.paidOut)).toBe(6000);
    expect(Number(stats.body.commission.paid)).toBe(6000);

    // Nothing left to pay.
    const again = await request(http).post(`/api/creator-commerce/creators/${creatorId}/payout`).set(auth(token)).send({});
    expect(again.status).toBe(400);
  });
});
