import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StoreSettings } from '../src/store-settings/store-settings.entity';
import { bootTestApp, resetDb } from './setup';

describe('Live sales reservations and photo repair (e2e)', () => {
  let app: INestApplication;
  let auth: string;
  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => {
    await resetDb(app);
    const registration = await request(app.getHttpServer()).post('/api/auth/register').send({ email: 'live@e2e.test', password: 'test-password' }).expect(201);
    auth = `Bearer ${registration.body.accessToken}`;
  });
  it('receives a bridge comment, reserves the pinned product, converts once and decrements stock', async () => {
    const http = app.getHttpServer();
    const product = await request(http).post('/api/pos/products').set('Authorization', auth).send({ name: 'Test jersey', sku: 'LIVE-1', price: 10000, stock: 8 }).expect(201);
    const session = await request(http).post('/api/live-sales').set('Authorization', auth).send({ title: 'Test live', platform: 'other' }).expect(201);
    await request(http).post(`/api/live-sales/${session.body.id}/pins`).set('Authorization', auth).send({ productId: product.body.id, code: 'A1' }).expect(201);
    const payload = { text: 'A1 x2', buyerHandle: 'test-buyer', externalId: 'test-comment', source: 'bridge' };
    const comment = await request(http).post(`/api/live-sales/ingest/${session.body.ingestToken}`).send(payload).expect(201);
    expect(comment.body.status).toBe('RESERVED');
    expect(comment.body.qty).toBe(2);
    const duplicate = await request(http).post(`/api/live-sales/ingest/${session.body.ingestToken}`).send(payload).expect(201);
    expect(duplicate.body.id).toBe(comment.body.id);
    const checkout = await request(http).get(`/api/live-sales/public/checkout/${comment.body.checkoutToken}`).expect(200);
    expect(checkout.body.product.id).toBe(product.body.id);
    const sale = await request(http).post(`/api/live-sales/comments/${comment.body.id}/convert`).set('Authorization', auth).send({}).expect(201);
    expect(sale.body.ok).toBe(true);
    expect(sale.body.order.liveSessionId).toBe(session.body.id);
    const saved = await request(http).get(`/api/pos/products/${product.body.id}`).set('Authorization', auth).expect(200);
    expect(saved.body.stock).toBe(6);
    await request(http).post(`/api/live-sales/comments/${comment.body.id}/convert`).set('Authorization', auth).send({}).expect(400);
    await request(http).post(`/api/live-sales/${session.body.id}/end`).set('Authorization', auth).send({}).expect(201);
    await request(http).post(`/api/live-sales/ingest/${session.body.ingestToken}`).send({ ...payload, externalId: 'after-end' }).expect(400);
  });
  it('quotes the selected social post, keeps private links out of public replies and saves pickup once', async () => {
    const http = app.getHttpServer();
    const authRequest = () => request(http).post('/api/live-sales').set('Authorization', auth);
    const product = (await request(http).post('/api/pos/products').set('Authorization', auth)
      .send({ name: 'T-shirt', sku: 'SOCIAL-1', price: 25000, stock: 8 }).expect(201)).body;
    await app.get(DataSource).getRepository(StoreSettings).save({
      ownerId: product.ownerId, domainSlug: 'social-shop', isPublished: true,
    });
    const old = (await authRequest().send({ title: 'Shirts', kind: 'post', platform: 'tiktok', postUrl: 'https://www.tiktok.com/@shop/video/123' }).expect(201)).body;
    const latest = (await authRequest().send({ title: 'Other campaign', kind: 'post', platform: 'tiktok', postUrl: 'https://www.tiktok.com/@shop/video/456' }).expect(201)).body;
    expect(old.id).not.toBe(latest.id);
    await request(http).post(`/api/live-sales/${old.id}/pins`).set('Authorization', auth).send({ productId: product.id, code: 'A1' }).expect(201);
    const submit = (text: string, externalId: string) => request(http).post(`/api/live-sales/ingest/${old.ingestToken}`).send({ text, externalId, buyerHandle: 'mnunuzi' }).expect(201);
    const [quote, duplicate] = await Promise.all([submit('Bei gani A1?', 'question'), submit('Bei gani A1?', 'question')]);
    const replies = [quote.body, duplicate.body].filter(comment => comment.publicReply);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ status: 'NEW', checkoutToken: '' });
    expect(replies[0].publicReply).toContain('TZS 25,000');
    expect(replies[0].publicReply).toContain(`campaign=${old.id}&item=A1`);
    const buy = await submit('Nataka mbili', 'buy');
    expect(buy.body).toMatchObject({ status: 'MATCHED', qty: 2, checkoutToken: '' });
    expect(buy.body.publicReply).not.toContain('live=');
    const unrelated = await submit("I don't want to buy A1", 'unrelated');
    expect(unrelated.body).toMatchObject({ status: 'NEW', checkoutToken: '' });
    expect(unrelated.body.publicReply).toBeUndefined();
    const catalog = await request(http).get('/api/live-sales/public/social-shop').query({ campaign: old.id }).expect(200);
    expect(catalog.body.products[0]).toMatchObject({ productId: product.id, code: 'A1' });
    const reservation = (await request(http).post('/api/live-sales/public/social-shop/reserve')
      .send({ campaign: old.id, code: 'A1', qty: 2 }).expect(201)).body;
    const order = (suffix: string) => request(http).post('/api/store/social-shop/orders').send({
      orderNumber: `SOCIAL-${suffix}`, lines: [{ productId: product.id, quantity: 2 }], customerName: 'Buyer', customerPhone: '+255712345678',
      fulfillmentMethod: 'PICKUP', fulfillmentLocation: 'Kariakoo shop', paymentMethod: 'CASH', liveCheckoutToken: reservation.checkoutToken,
    });
    const orders = await Promise.all([order('A'), order('B')]);
    expect(orders.map(result => result.status).sort()).toEqual([201, 400]);
    expect(orders.find(result => result.status === 201)?.body).toMatchObject({
      fulfillmentMethod: 'PICKUP', fulfillmentLocation: 'Kariakoo shop', liveSessionId: old.id, salesChannel: 'tiktok-post',
    });
    expect((await request(http).get(`/api/pos/products/${product.id}`).set('Authorization', auth).expect(200)).body.stock).toBe(6);
  });

  it('persists an unresolved photo report and isolates retry from another owner', async () => {
    const http = app.getHttpServer();
    const missing = '/api/media/blob/44444444-4444-4444-4444-444444444444';
    const product = await request(http).post('/api/pos/products').set('Authorization', auth).send({ name: 'Missing photo', price: 100, imageUrl: missing }).expect(201);
    await request(http).get('/api/pos/products').set('Authorization', auth).expect(200);
    const saved = await request(http).get(`/api/pos/products/${product.body.id}`).set('Authorization', auth).expect(200);
    expect(saved.body.photoRepair.unresolved).toEqual([missing]);
    const report = await request(http).get('/api/pos/products/photo-issues').set('Authorization', auth).expect(200);
    expect(report.body.map((item: { id: string }) => item.id)).toContain(product.body.id);
    const other = await request(http).post('/api/auth/register').send({ email: 'foreign@e2e.test', password: 'test-password' }).expect(201);
    await request(http).post(`/api/pos/products/${product.body.id}/retry-photo`).set('Authorization', `Bearer ${other.body.accessToken}`).send({}).expect(404);
    await request(http).post(`/api/pos/products/${product.body.id}/retry-photo`).set('Authorization', auth).send({}).expect(201);
  });
});
