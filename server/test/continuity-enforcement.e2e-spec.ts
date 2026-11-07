import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { ContinuityService } from '../src/cloud-continuity/continuity.service';
import { ProductSnippet } from '../src/commerce/commerce.entity';
import { PosProduct } from '../src/pos/pos.entity';
import { HotelBooking } from '../src/hotel/hotel.entity';

/**
 * Local enforcement and cancellation.
 *
 * The allotment is only worth anything if every local path respects it. A till
 * sale, a manual recount and an online checkout all reach the same units, so
 * each is tested against capacity the cloud owns — and cancellation is tested
 * for returning that capacity exactly once rather than once per retry.
 */
describe('Continuity enforcement on local paths (e2e)', () => {
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
    return { token: r.body.accessToken as string, id: r.body.user.id as string };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** A till product plus the online snippet that mirrors it. */
  const stockedProduct = async (token: string, ownerId: string, stock: number) => {
    const created = await request(http).post('/api/pos/products').set(auth(token))
      .send({ sku: `SKU-${Date.now()}`, name: 'Shared Item', price: 1000, stock, category: 'general' });
    expect(created.status).toBe(201);
    const productId = created.body.id as string;
    const businessId = '33333333-3333-3333-3333-333333333333';
    const snippets = ds.getRepository(ProductSnippet);
    await snippets.save(snippets.create({
      businessId, productId, catalogOwnerId: ownerId, name: 'Shared Item',
      price: 1000, currency: 'TZS', stock, active: true, indexedAt: new Date(),
      allocatedQty: 0, remainingQty: 0, committedQty: 0,
    } as Partial<ProductSnippet>));
    return { productId, businessId };
  };

  let orderSeq = 0;
  const sellAtTill = (token: string, productId: string, quantity: number) =>
    request(http).post('/api/pos/orders').set(auth(token)).send({
      orderNumber: `TILL-${Date.now()}-${++orderSeq}`,
      lines: [{ productId, quantity }],
      paymentMethod: 'CASH',
    });

  describe('a till sale cannot take the cloud allotment', () => {
    it('refuses the sale when only allotted units would be left', async () => {
      const me = await register('enf-till@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 5);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 2 });

      // Three are the operator's; the other two belong online.
      const ok = await sellAtTill(me.token, productId, 3);
      expect(ok.status).toBe(201);

      const refused = await sellAtTill(me.token, productId, 1);
      expect(refused.status).toBe(400);
      expect(String(refused.body.message)).toMatch(/allotted to online booking/i);

      const product = await ds.getRepository(PosProduct).findOneByOrFail({ id: productId });
      expect(Number(product.stock)).toBe(2);
    });

    it('sells freely once the allotment is given back', async () => {
      const me = await register('enf-till-free@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 4);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 4 });
      expect((await sellAtTill(me.token, productId, 1)).status).toBe(400);

      await continuity.allocateProduct(me.id, { businessId, productId, qty: 0 });
      expect((await sellAtTill(me.token, productId, 4)).status).toBe(201);
    });

    it('holds under two simultaneous till sales for the unallotted remainder', async () => {
      const me = await register('enf-till-race@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 3);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 2 });

      // One unit is sellable locally. Two tills reach for it at once.
      const [a, b] = await Promise.all([
        sellAtTill(me.token, productId, 1),
        sellAtTill(me.token, productId, 1),
      ]);
      expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);

      const product = await ds.getRepository(PosProduct).findOneByOrFail({ id: productId });
      expect(Number(product.stock)).toBe(2);
    });

    it('does not let a till sale and an online checkout both take the last unit', async () => {
      const me = await register('enf-both@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 2);
      // One allotted online, one left locally.
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 1 });

      const [till, online] = await Promise.all([
        sellAtTill(me.token, productId, 1),
        continuity.consumeProductAllowance(businessId, productId, 1),
      ]);

      // Each had its own unit, so both succeed and nothing is oversold.
      expect(till.status).toBe(201);
      expect(online).toBe(true);

      // Neither side has anything left. The till is refused even though
      // `stock` still reads 1: that unit is the online sale, waiting to sync.
      expect((await sellAtTill(me.token, productId, 1)).status).toBe(400);
      expect(await continuity.consumeProductAllowance(businessId, productId, 1)).toBe(false);

      const held = await ds.getRepository(ProductSnippet).findOneByOrFail({ businessId, productId });
      expect(held.remainingQty).toBe(0);
      expect(held.committedQty).toBe(1);

      // Once the order's deduction lands, the hold is released and the shelf
      // is simply empty rather than permanently short.
      const product = await ds.getRepository(PosProduct).findOneByOrFail({ id: productId });
      product.stock = Number(product.stock) - 1;
      await ds.getRepository(PosProduct).save(product);
      await continuity.settleCommitted(businessId, productId, 1);
      expect(await continuity.localSellable(businessId, productId)).toBe(0);
    });
  });

  describe('a manual stock change cannot strand the allotment', () => {
    it('refuses a recount below the allotted quantity', async () => {
      const me = await register('enf-manual@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 10);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 4 });

      const refused = await request(http).patch(`/api/pos/products/${productId}`)
        .set(auth(me.token)).send({ stock: 3 });
      expect(refused.status).toBe(400);
      expect(String(refused.body.message)).toMatch(/allotted to online booking/i);

      const unchanged = await ds.getRepository(PosProduct).findOneByOrFail({ id: productId });
      expect(Number(unchanged.stock)).toBe(10);
    });

    it('allows a recount down to exactly the allotted quantity', async () => {
      const me = await register('enf-manual-exact@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 10);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 4 });

      const ok = await request(http).patch(`/api/pos/products/${productId}`)
        .set(auth(me.token)).send({ stock: 4 });
      expect(ok.status).toBe(200);
    });

    it('still allows unrelated edits', async () => {
      const me = await register('enf-manual-other@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 6);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 6 });

      const ok = await request(http).patch(`/api/pos/products/${productId}`)
        .set(auth(me.token)).send({ name: 'Renamed Item' });
      expect(ok.status).toBe(200);
      expect(ok.body.name).toBe('Renamed Item');
    });
  });

  describe('cancellation releases capacity exactly once', () => {
    const makeRoom = async (token: string, roomNumber: string) => {
      const hotel = await request(http).post('/api/hotel/properties').set(auth(token))
        .send({ name: 'Cancel Inn', slug: `cancel-${roomNumber}`, currency: 'TZS' });
      const room = await request(http).post('/api/hotel/rooms').set(auth(token))
        .send({ hotelId: hotel.body.id, roomNumber, type: 'Single', rate: 30000, capacity: 1 });
      return { hotelId: hotel.body.id as string, roomId: room.body.id as string };
    };

    it('cancels a cloud booking once, however many times the cancellation is retried', async () => {
      const me = await register('enf-cancel@e2e.test');
      const { roomId } = await makeRoom(me.token, '501');
      await continuity.absorbCloudBooking(me.id, 'cb-1', {
        roomId, guestName: 'Online Guest', guestPhone: '0715000000',
        checkIn: '2027-06-01', checkOut: '2027-06-03',
      });

      const first = await continuity.absorbCloudCancellation(me.id, 'cb-1', 'guest changed plans');
      const second = await continuity.absorbCloudCancellation(me.id, 'cb-1');
      const third = await continuity.absorbCloudCancellation(me.id, 'cb-1');

      expect(first.cancelled).toBe(true);
      expect(second.alreadyHandled).toBe(true);
      expect(third.alreadyHandled).toBe(true);

      const booking = await ds.getRepository(HotelBooking).findOneByOrFail({ ownerId: me.id, cloudOriginId: 'cb-1' });
      expect(booking.status).toBe('CANCELLED');
    });

    it('survives two cancellations racing each other', async () => {
      const me = await register('enf-cancel-race@e2e.test');
      const { roomId } = await makeRoom(me.token, '502');
      await continuity.absorbCloudBooking(me.id, 'cb-2', {
        roomId, guestName: 'Racer', guestPhone: '0716000000',
        checkIn: '2027-06-05', checkOut: '2027-06-07',
      });

      const results = await Promise.all([
        continuity.absorbCloudCancellation(me.id, 'cb-2'),
        continuity.absorbCloudCancellation(me.id, 'cb-2'),
      ]);
      expect(results.filter((r) => r.cancelled)).toHaveLength(1);
    });

    it('will not quietly cancel a guest who has already checked in', async () => {
      const me = await register('enf-cancel-checkedin@e2e.test');
      const { roomId } = await makeRoom(me.token, '503');
      const { booking } = await continuity.absorbCloudBooking(me.id, 'cb-3', {
        roomId, guestName: 'Arrived', guestPhone: '0717000000',
        checkIn: '2027-06-10', checkOut: '2027-06-12',
      });
      const checkedIn = await request(http)
        .post(`/api/hotel/front-desk/bookings/${booking.id}/check-in`).set(auth(me.token)).send({});
      expect(checkedIn.status).toBe(201);

      const result = await continuity.absorbCloudCancellation(me.id, 'cb-3');

      // Flagged for staff, not applied: both the arrival and the cancellation
      // really happened and a person has to decide.
      expect(result.conflict).toBe(true);
      expect(result.cancelled).toBe(false);
      const after = await ds.getRepository(HotelBooking).findOneByOrFail({ id: booking.id });
      expect(after.status).toBe('CHECKED_IN');
    });

    it('holds a cancellation that arrives before its booking', async () => {
      const me = await register('enf-cancel-early@e2e.test');
      const early = await continuity.absorbCloudCancellation(me.id, 'cb-unknown');
      expect(early.cancelled).toBe(false);
      expect(early.alreadyHandled).toBe(false);

      // Replaying it is still not a second claim.
      const again = await continuity.absorbCloudCancellation(me.id, 'cb-unknown');
      expect(again.alreadyHandled).toBe(true);
    });

    it('returns an online order\'s units to the allotment exactly once', async () => {
      const me = await register('enf-order-cancel@e2e.test');
      const { productId, businessId } = await stockedProduct(me.token, me.id, 5);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 3 });
      expect(await continuity.consumeProductAllowance(businessId, productId, 3)).toBe(true);

      const first = await continuity.absorbCloudOrderCancellation(me.id, 'co-1', { businessId, productId, qty: 1 });
      const second = await continuity.absorbCloudOrderCancellation(me.id, 'co-1', { businessId, productId, qty: 1 });
      const third = await continuity.absorbCloudOrderCancellation(me.id, 'co-1', { businessId, productId, qty: 1 });

      expect(first.returned).toBe(true);
      expect(second.alreadyHandled).toBe(true);
      expect(third.alreadyHandled).toBe(true);

      // One unit back, not three.
      const snippet = await ds.getRepository(ProductSnippet).findOneByOrFail({ businessId, productId });
      expect(snippet.remainingQty).toBe(1);
    });
  });
});
