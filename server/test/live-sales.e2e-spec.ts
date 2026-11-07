import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
