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
    const purchaseCost = { unitPrice: 30, currency: 'CNY', exchangeRate: 360, transportPerUnit: 1200 };
    const confirm = () => request(http).post(`/api/media/inbox/guided/${photoId}/confirm`).set(headers).send({
      businessType: 'shop', name: 'Jeans', category: 'Clothing', price: 60000, discountPrice: 55000, stock: 7, size: '',
      purchaseCost, variants: [{ color: 'Blue', size: '32', price: 60000, stock: 7 }],
    });
    const replies = await Promise.all([confirm(), confirm()]);
    expect(replies.map(r => r.status)).toEqual([201, 201]);
    expect(replies.map(r => r.body.duplicate).sort()).toEqual([false, true]);
    expect(replies[0].body.entityId).toBe(replies[1].body.entityId);

    const productId = replies[0].body.entityId;
    const product = await request(http).get(`/api/pos/products/${productId}`).set(headers);
    expect(Number(product.body.price)).toBe(60000);
    expect(Number(product.body.cost)).toBe(12000);
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

  const uploadPhoto = async (token: string, type: string, color: string) => {
    const image = await sharp({ create: { width: 3, height: 3, channels: 3, background: color } }).png().toBuffer();
    const result = await request(http).post(`/api/media/inbox/guided/upload?businessType=${type}`).set(auth(token)).attach('files', image, 'listing.png');
    expect(result.status).toBe(201);
    return result.body[0].item.id as string;
  };

  it('adds another colour and gallery photo to the same product without changing its price', async () => {
    const token = await register('guided-colours@e2e.test');
    const first = await uploadPhoto(token, 'shop', 'blue');
    const second = await uploadPhoto(token, 'shop', 'black');
    const base = { businessType: 'shop', name: 'Jeans', category: 'Clothing', size: '32', price: 60000 };
    const created = await request(http).post(`/api/media/inbox/guided/${first}/confirm`).set(auth(token)).send({ ...base, stock: 5, color: 'Blue' });
    expect(created.status).toBe(201);
    const productId = created.body.entityId;
    const attach = () => request(http).post(`/api/media/inbox/guided/${second}/confirm`).set(auth(token)).send({
      ...base, relatedEntityId: productId, price: 0, stock: 3, color: 'Black',
    });
    expect((await attach()).body).toMatchObject({ entityId: productId, duplicate: false });
    expect((await attach()).body).toMatchObject({ entityId: productId, duplicate: true });
    const products = await request(http).get('/api/pos/products').set(auth(token));
    expect(products.body).toHaveLength(1);
    expect(products.body[0]).toMatchObject({ name: 'Jeans', stock: 8, variants: [
      expect.objectContaining({ stock: 5, attributes: { color: 'Blue', size: '32' } }),
      expect.objectContaining({ stock: 3, attributes: { color: 'Black', size: '32' } }),
    ] });
    expect(Number(products.body[0].price)).toBe(60000);
    expect(products.body[0].imageUrls).toHaveLength(2);
  });

  it('publishes guided vehicle facts and adds angles to the same public dealer listing', async () => {
    const token = await register('guided-dealer@e2e.test');
    const business = await request(http).post('/api/commerce/businesses').set(auth(token)).send({ name: 'Guided Motors' });
    expect(business.status).toBe(201);
    const first = await uploadPhoto(token, 'dealership', 'silver');
    const second = await uploadPhoto(token, 'dealership', 'grey');
    const base = { businessType: 'dealership', name: '2019 Toyota Prado', category: 'Vehicle', price: 80000000, size: '', stock: 0 };
    const created = await request(http).post(`/api/media/inbox/guided/${first}/confirm`).set(auth(token)).send({
      ...base, vehicle: { make: 'Toyota', model: 'Prado', year: 2019, mileage: 65000, condition: 'USED', availability: 'AVAILABLE',
        transmission: 'Automatic', fuel: 'Diesel', color: 'Silver', location: 'Mbezi Beach', description: 'Seven seats.',
        features: ['Parking camera'], negotiable: true, financingAvailable: true, published: true },
    });
    expect(created.status).toBe(201);
    const attached = await request(http).post(`/api/media/inbox/guided/${second}/confirm`).set(auth(token)).send({ ...base, relatedEntityId: created.body.entityId });
    expect(attached.status).toBe(201);
    const dealer = await request(http).get(`/api/commerce-public/dealers/${business.body.publicSlug}`);
    expect(dealer.status).toBe(200);
    expect(dealer.body.vehicles).toHaveLength(1);
    expect(dealer.body.vehicles[0]).toMatchObject({ make: 'Toyota', model: 'Prado', mileage: 65000, transmission: 'Automatic', financingAvailable: true });
    expect(dealer.body.vehicles[0].media).toHaveLength(2);
    const jumla = await request(http).get('/api/commerce-public/cars?make=Toyota&model=Prado');
    expect(jumla.body).toHaveLength(1);
  });

  it('keeps a residential draft private and publishes the reviewed property and gallery', async () => {
    const token = await register('guided-property@e2e.test');
    const other = await register('guided-other-property@e2e.test');
    const first = await uploadPhoto(token, 'property', 'green');
    const second = await uploadPhoto(token, 'property', 'white');
    const base = { businessType: 'property', name: 'Mbezi apartment', category: 'Apartment', price: 800000, size: '', stock: 0 };
    const property = { title: base.name, kind: 'Apartment', offer: 'RENT', price: base.price, location: 'Mbezi Beach',
      bedrooms: 2, bathrooms: 2, areaM2: 95.5, description: 'Apartment close to the main road.', amenities: ['Parking'], contactPhone: '+255700000001', published: false };
    const created = await request(http).post(`/api/media/inbox/guided/${first}/confirm`).set(auth(token)).send({ ...base, property });
    expect(created.status).toBe(201);
    const id = created.body.entityId;
    const attached = await request(http).post(`/api/media/inbox/guided/${second}/confirm`).set(auth(token)).send({ ...base, relatedEntityId: id });
    expect(attached.status).toBe(201);
    expect((await request(http).get(`/api/property-public/listings/${id}`)).status).toBe(404);
    expect((await request(http).patch(`/api/property/listings/${id}`).set(auth(other)).send({ ...property, published: true })).status).toBe(404);
    const published = await request(http).patch(`/api/property/listings/${id}`).set(auth(token)).send({ ...property, published: true });
    expect(published.status).toBe(200);
    const listing = await request(http).get(`/api/property-public/listings/${id}`);
    expect(listing.body).toMatchObject({ title: base.name, offer: 'RENT', bedrooms: 2, amenities: ['Parking'] });
    expect(listing.body).not.toHaveProperty('ownerId');
    expect(listing.body.imageUrls).toHaveLength(2);
    expect((await request(http).get('/api/property-public/listings?q=Mbezi&offer=RENT')).body).toHaveLength(1);
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
