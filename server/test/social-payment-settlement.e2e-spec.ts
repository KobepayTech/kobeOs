import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PosOrder, PosProduct } from '../src/pos/pos.entity';
import { ErpTransaction, LoyaltyCustomer } from '../src/erp/erp.entity';
import { LiveSession } from '../src/live-sales/live-sale.entity';
import { StoreSettings } from '../src/store-settings/store-settings.entity';
import { WarehousePickTicket } from '../src/warehouse/pick-ticket.entity';
import { SocialCheckoutPaymentsService } from '../src/pos/social-checkout-payments.service';
import { bootTestApp, resetDb } from './setup';

describe('Social checkout mobile-money settlement', () => {
  let app: INestApplication;
  let db: DataSource;
  let auth: string;
  let product: PosProduct;
  let session: LiveSession;
  let token: string;
  let providerState: string;
  let providerAmount: number;
  let merchantReference: string;
  let providerOrderId: string;
  let providerFetch: jest.SpyInstance;

  beforeAll(async () => {
    app = await bootTestApp();
    db = app.get(DataSource);
    app.get(ConfigService).set('PALMPESA_API_TOKEN', 'mock-token');
    app.get(ConfigService).set('APP_PUBLIC_URL', 'https://api.kobeapptz.com');
  });
  afterAll(async () => { await app?.close(); });
  afterEach(() => jest.restoreAllMocks());

  beforeEach(async () => {
    await resetDb(app);
    const http = app.getHttpServer();
    const registration = await request(http).post('/api/auth/register').send({ email: 'social-pay@e2e.test', password: 'test-password' }).expect(201);
    auth = `Bearer ${registration.body.accessToken}`;
    product = (await request(http).post('/api/pos/products').set('Authorization', auth)
      .send({ name: 'T-shirt', sku: 'PAY-1', price: 25000, stock: 8 }).expect(201)).body;
    await db.getRepository(StoreSettings).save({ ownerId: product.ownerId, domainSlug: 'pay-shop', isPublished: true });
    session = (await request(http).post('/api/live-sales').set('Authorization', auth)
      .send({ kind: 'post', platform: 'tiktok', postUrl: 'https://www.tiktok.com/@shop/video/123' }).expect(201)).body;
    await request(http).post(`/api/live-sales/${session.id}/pins`).set('Authorization', auth)
      .send({ productId: product.id, code: 'A1' }).expect(201);
    token = (await request(http).post('/api/live-sales/public/pay-shop/reserve')
      .send({ campaign: session.id, code: 'A1', qty: 2 }).expect(201)).body.checkoutToken;
    providerState = 'PENDING';
    providerAmount = 50000;
    providerOrderId = 'PALMPESAV2-TEST';
    providerFetch = jest.spyOn(global, 'fetch').mockImplementation(async (url, options) => {
      const endpoint = String(url);
      if (!endpoint.startsWith('https://palmpesa.co.tz/api/v2/async/payments')) throw new Error('Unexpected external request');
      if (options?.method === 'POST') {
        const payload = JSON.parse(String(options.body));
        merchantReference = payload.transaction_id;
        expect(payload).toMatchObject({ amount: 50000, currency: 'TZS', phone: '255712345678', email: 'social-pay@e2e.test',
          callback_url: 'https://api.kobeapptz.com/api/pos/social-checkout/palmpesa' });
        return Response.json({ success: true, data: {
          order_id: providerOrderId, transaction_id: merchantReference, status: 'INITIATING', amount: 50000, currency: 'TZS',
        } }, { status: 202 });
      }
      return Response.json({ success: true, data: {
        order_id: providerOrderId, transaction_id: merchantReference,
        status: providerState, amount: providerAmount, currency: 'TZS', reference: 'network-1',
      } });
    });
  });

  const place = () => request(app.getHttpServer()).post('/api/store/pay-shop/orders').send({
    orderNumber: 'SOCIAL-TEST', lines: [{ productId: product.id, quantity: 2 }],
    paymentMethod: 'MOBILE', customerName: 'Buyer', customerPhone: '+255712345678', fulfillmentMethod: 'PICKUP',
    fulfillmentLocation: 'Kariakoo shop', liveCheckoutToken: token,
  });
  const callback = (extra = {}) => request(app.getHttpServer()).post('/api/pos/social-checkout/palmpesa').send({
    transaction_id: merchantReference, order_id: providerOrderId, status: 'COMPLETED', amount: 50000, currency: 'TZS', ...extra,
  });
  const makeDue = () => db.query('UPDATE "pos_orders" SET "checkoutPaymentCheckedAt" = NULL');
  const order = () => db.getRepository(PosOrder).findOneByOrFail({ ownerId: product.ownerId });
  const tickets = () => db.getRepository(WarehousePickTicket).countBy({ ownerId: product.ownerId });
  const journal = () => db.getRepository(ErpTransaction).countBy({ ownerId: product.ownerId });

  it('keeps a forged or mismatched result pending and posts a verified sale only once', async () => {
    const started = await Promise.all([place().expect(201), place().expect(201)]);
    expect(started[0].body).toMatchObject({ paymentState: 'PENDING', amount: 50000 });
    expect(started[1].body.orderNumber).toBe(started[0].body.orderNumber);
    expect(await db.getRepository(LoyaltyCustomer).countBy({ ownerId: product.ownerId })).toBe(1);
    expect(providerFetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    const pending = await order();
    expect(pending.status).toBe('PENDING');
    expect(await tickets()).toBe(0);
    expect(await journal()).toBe(0);
    const http = app.getHttpServer();
    expect((await request(http).get('/api/pos/orders/kds').set('Authorization', auth).expect(200)).body).toEqual([]);
    await request(http).patch(`/api/pos/orders/${pending.id}`).set('Authorization', auth).send({ status: 'COMPLETED' }).expect(400);
    await request(http).post(`/api/pos/orders/${pending.id}/start`).set('Authorization', auth).expect(400);

    await makeDue();
    await callback({ order_id: 'forged' }).expect(200);
    await callback().expect(200);
    expect((await order()).checkoutPaymentState).toBe('PENDING');
    providerState = 'COMPLETED';
    providerAmount = 49999;
    await makeDue();
    await callback().expect(200);
    expect((await order()).checkoutPaymentState).toBe('PENDING');

    providerAmount = 50000;
    await makeDue();
    await Promise.all([callback().expect(200), callback().expect(200)]);
    expect(await order()).toMatchObject({ status: 'COMPLETED', checkoutPaymentState: 'PAID' });
    expect(await tickets()).toBe(1);
    const posted = await journal();
    expect(posted).toBeGreaterThan(0);
    await makeDue();
    await callback().expect(200);
    expect(await journal()).toBe(posted);
    expect((await db.getRepository(LoyaltyCustomer).findOneByOrFail({ ownerId: product.ownerId })).purchaseCount).toBe(1);
    expect((await db.getRepository(LiveSession).findOneByOrFail({ id: session.id })).orderCount).toBe(1);
    expect((await request(http).get(`/api/live-sales/public/checkout/${token}`).expect(200)).body.payment.paymentState).toBe('PAID');
  });

  it('restores stock once for an expired direct checkout and flags a verified late payment', async () => {
    const http = app.getHttpServer();
    await request(http).post(`/api/live-sales/public/checkout/${token}/pay`).send({ buyerContact: '0712345678' }).expect(201);
    expect((await db.getRepository(PosProduct).findOneByOrFail({ id: product.id })).stock).toBe(6);
    providerState = 'EXPIRED';
    await makeDue();
    await app.get(SocialCheckoutPaymentsService).reconcileOpenPayments();
    expect(await order()).toMatchObject({ status: 'CANCELLED', checkoutPaymentState: 'EXPIRED' });
    expect((await db.getRepository(PosProduct).findOneByOrFail({ id: product.id })).stock).toBe(8);
    providerState = 'COMPLETED';
    await makeDue();
    await callback().expect(200);
    expect(await order()).toMatchObject({ status: 'CANCELLED', checkoutPaymentState: 'REVIEW' });
    expect(await tickets()).toBe(0);
    expect(await journal()).toBe(0);
    expect((await db.getRepository(PosProduct).findOneByOrFail({ id: product.id })).stock).toBe(8);
  });
  it('retries a lost initiation response with the same reference and releases rejected orders', async () => {
    providerFetch.mockImplementationOnce(async (_url, options) => {
      merchantReference = JSON.parse(String(options?.body)).transaction_id;
      throw new Error('Connection lost after the provider accepted the payment');
    });
    expect((await place().expect(201)).body.paymentState).toBe('PENDING');
    const original = merchantReference;
    providerState = 'REJECTED';
    await makeDue();
    await app.get(SocialCheckoutPaymentsService).reconcileOpenPayments();
    const attempts = providerFetch.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(attempts).toHaveLength(2);
    expect(attempts.every(([, options]) => JSON.parse(String(options?.body)).transaction_id === original)).toBe(true);
    expect(await order()).toMatchObject({ status: 'CANCELLED', checkoutPaymentState: 'FAILED' });
    expect((await db.getRepository(PosProduct).findOneByOrFail({ id: product.id })).stock).toBe(8);
    expect(await tickets()).toBe(0);
    expect(await journal()).toBe(0);
  });

});
