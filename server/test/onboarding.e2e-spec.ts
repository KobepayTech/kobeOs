import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { KobeAgentService } from '../src/ai/agent.service';
import { bootTestApp, resetDb } from './setup';

/**
 * A new account should be led somewhere, not dropped into 30 empty apps.
 * These exercise the real endpoints so the derivation is proven against the
 * records it actually reads, not just against a hand-built facts object.
 */
describe('Account onboarding (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string): Promise<string> => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('keeps the document name separate and saves one product when photo confirmation is retried', async () => {
    const token = await register('guided-shop@e2e.test');
    const headers = auth(token);
    const saved = await request(http).put('/api/onboarding/guided').set(headers).send({
      businessType: 'shop', businessName: 'Steve’s Jeans', displayName: 'Steve',
      nameKind: 'username', documentName: 'KobeTech', employeeCount: 50, services: ['retail', 'office'],
      location: 'Dar es Salaam', phone: '', language: 'English', currency: 'TZS', timezone: 'Africa/Dar_es_Salaam',
    });
    expect(saved.status).toBe(200);
    const profile = await request(http).get('/api/onboarding/guided').set(headers);
    expect(profile.body).toMatchObject({ displayName: 'Steve', documentName: 'KobeTech', employeeCount: 50 });

    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer();
    const upload = await request(http).post('/api/media/inbox/guided/upload?businessType=shop').set(headers)
      .attach('files', image, 'jeans.png');
    expect(upload.status).toBe(201);
    const photoId = upload.body[0].item.id;
    const confirm = () => request(http).post(`/api/media/inbox/guided/${photoId}/confirm`).set(headers).send({
      businessType: 'shop', name: 'Jeans', category: 'Clothing', price: 60000, discountPrice: 55000, stock: 7, size: '',
      variants: [{ color: 'Blue', size: '32', price: 60000, stock: 7 }],
    });
    const replies = await Promise.all([confirm(), confirm()]);
    expect(replies.map(r => r.status)).toEqual([201, 201]);
    expect(replies.map(r => r.body.duplicate).sort()).toEqual([false, true]);
    expect(replies[0].body.entityId).toBe(replies[1].body.entityId);

    const productId = replies[0].body.entityId;
    const product = await request(http).get(`/api/pos/products/${productId}`).set(headers);
    expect(Number(product.body.price)).toBe(60000);
    expect(product.body).not.toHaveProperty('discountReferencePrice');
    expect(product.body.variants[0]).toMatchObject({ stock: 7, attributes: { size: '32', color: 'Blue' } });
    const ownerId = product.body.ownerId;
    const advice = await app.get(KobeAgentService).run(ownerId, 'Discount price for Jeans?');
    expect(advice.used).toBe('product_pricing');
    expect(advice.reply).toContain('55,000');

    const sale = await request(http).post('/api/pos/orders').set(headers).send({
      orderNumber: 'GUIDED-1', lines: [{ productId, quantity: 1 }], paymentMethod: 'CASH',
    });
    expect(sale.status).toBe(201);
    expect(sale.body.receipt.text.trimStart()).toMatch(/^KobeTech\n/);
    expect(Number(sale.body.total)).toBe(60000);
  });

  it('puts a freshly registered account at the first step', async () => {
    const t = await register('onboard-new@e2e.test');
    const res = await request(http).get('/api/onboarding').set(auth(t));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'PROFILE_CREATION',
      completed: false,
      completedCount: 0,
      totalCount: 3,
    });
  });

  it('credits the business step when the shop is named through store settings', async () => {
    // Named from the Store Editor, not the wizard: the step is still done.
    const t = await register('onboard-shop@e2e.test');
    const saved = await request(http)
      .put('/api/store-settings')
      .set(auth(t))
      .send({ storeName: 'Duka la Juma' });
    expect([200, 201]).toContain(saved.status);

    const res = await request(http).get('/api/onboarding').set(auth(t));
    const business = res.body.steps.find((s: { step: string }) => s.step === 'BUSINESS_SETUP');
    expect(business).toMatchObject({ done: true, skipped: false });
  });

  it('skips a step, then resumes it', async () => {
    const t = await register('onboard-skip@e2e.test');

    const skipped = await request(http)
      .post('/api/onboarding/skip')
      .set(auth(t))
      .send({ step: 'PROFILE_CREATION' });
    expect(skipped.status).toBe(201);
    expect(skipped.body.status).toBe('BUSINESS_SETUP');
    expect(skipped.body.steps.find((s: { step: string }) => s.step === 'PROFILE_CREATION'))
      .toMatchObject({ skipped: true, done: false });

    const resumed = await request(http)
      .post('/api/onboarding/resume')
      .set(auth(t))
      .send({ step: 'PROFILE_CREATION' });
    expect(resumed.body.status).toBe('PROFILE_CREATION');
  });

  it('rejects a step name that is not part of the flow', async () => {
    const t = await register('onboard-bad@e2e.test');
    const res = await request(http)
      .post('/api/onboarding/skip')
      .set(auth(t))
      .send({ step: 'BOOK_CALL' });
    expect(res.status).toBe(400);
  });

  it('dismisses onboarding and brings it back on resume', async () => {
    const t = await register('onboard-dismiss@e2e.test');

    const dismissed = await request(http).post('/api/onboarding/dismiss').set(auth(t)).send({});
    expect(dismissed.body).toMatchObject({ status: 'COMPLETED', completed: true });

    const resumed = await request(http)
      .post('/api/onboarding/resume')
      .set(auth(t))
      .send({ step: 'PROFILE_CREATION' });
    expect(resumed.body).toMatchObject({ status: 'PROFILE_CREATION', completed: false });
  });

  it('keeps each account\'s progress to itself', async () => {
    const a = await register('onboard-a@e2e.test');
    const b = await register('onboard-b@e2e.test');

    await request(http).post('/api/onboarding/dismiss').set(auth(a)).send({});

    const other = await request(http).get('/api/onboarding').set(auth(b));
    expect(other.body).toMatchObject({ status: 'PROFILE_CREATION', completed: false });
  });

  it('requires authentication', async () => {
    const res = await request(http).get('/api/onboarding');
    expect(res.status).toBe(401);
  });
});
