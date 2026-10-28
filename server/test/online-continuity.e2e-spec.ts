import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { ContinuityService } from '../src/cloud-continuity/continuity.service';
import { CloudRoomAllotment } from '../src/cloud-continuity/continuity.entity';
import { ProductSnippet } from '../src/commerce/commerce.entity';
import { HotelBooking } from '../src/hotel/hotel.entity';

/**
 * The online continuity layer under partition.
 *
 * One successful sale followed by a reconnection proves almost nothing. What
 * has to hold is that two attempts on the last unit produce one sale, that a
 * retried sync produces one booking, that a cancellation returns capacity, and
 * that reclaiming capacity needs the cloud's acknowledgement rather than just
 * a reconnection or an expired window.
 */
describe('Online continuity under partition (e2e)', () => {
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

  const makeHotelAndRoom = async (token: string, roomNumber: string) => {
    const hotel = await request(http).post('/api/hotel/properties').set(auth(token))
      .send({ name: 'Continuity Inn', slug: `continuity-${roomNumber}`, currency: 'TZS' });
    expect(hotel.status).toBe(201);
    const room = await request(http).post('/api/hotel/rooms').set(auth(token))
      .send({ hotelId: hotel.body.id, roomNumber, type: 'Double', rate: 50000, capacity: 2 });
    expect(room.status).toBe(201);
    return { hotelId: hotel.body.id as string, roomId: room.body.id as string };
  };

  const reserve = (token: string, roomId: string, checkIn: string, checkOut: string) =>
    request(http).post('/api/hotel/front-desk/reservations').set(auth(token)).send({
      roomId, guestName: 'Walk In', guestPhone: '0712000000',
      checkIn, checkOut, guestCount: 1,
    });

  /** A published product with a known reported stock. */
  const publishProduct = async (ownerId: string, stock: number) => {
    const repo = ds.getRepository(ProductSnippet);
    const businessId = '11111111-1111-1111-1111-111111111111';
    const productId = '22222222-2222-2222-2222-222222222222';
    await repo.save(repo.create({
      businessId, productId, catalogOwnerId: ownerId, name: 'Last Item',
      price: 1000, currency: 'TZS', stock, active: true, indexedAt: new Date(),
      allocatedQty: 0, remainingQty: 0, committedQty: 0,
    } as Partial<ProductSnippet>));
    return { businessId, productId };
  };

  describe('the last unit cannot be sold twice', () => {
    it('gives exactly one of two concurrent online attempts the last unit', async () => {
      const me = await register('cont-last@e2e.test');
      const { businessId, productId } = await publishProduct(me.id, 5);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 1 });

      // Both arrive at once, as two online customers would.
      const [a, b] = await Promise.all([
        continuity.consumeProductAllowance(businessId, productId, 1),
        continuity.consumeProductAllowance(businessId, productId, 1),
      ]);

      expect([a, b].filter(Boolean)).toHaveLength(1);
      const after = await ds.getRepository(ProductSnippet).findOneByOrFail({ businessId, productId });
      expect(after.remainingQty).toBe(0);
    });

    it('refuses an online sale beyond the allotment even when stock remains', async () => {
      const me = await register('cont-beyond@e2e.test');
      const { businessId, productId } = await publishProduct(me.id, 20);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 2 });

      expect(await continuity.consumeProductAllowance(businessId, productId, 2)).toBe(true);
      // 18 units are still on the shelf, but none of them are the cloud's.
      expect(await continuity.consumeProductAllowance(businessId, productId, 1)).toBe(false);
    });

    it('keeps local sellable quantity apart from the online allowance', async () => {
      const me = await register('cont-split@e2e.test');
      const { businessId, productId } = await publishProduct(me.id, 10);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 3 });

      expect(await continuity.localSellable(businessId, productId)).toBe(7);

      // A heartbeat recount must not restore spent allowance.
      await continuity.consumeProductAllowance(businessId, productId, 2);
      const repo = ds.getRepository(ProductSnippet);
      const snippet = await repo.findOneByOrFail({ businessId, productId });
      snippet.stock = 10; // the merchant recounts and still sees ten
      await repo.save(snippet);

      const reread = await repo.findOneByOrFail({ businessId, productId });
      expect(reread.remainingQty).toBe(1);
      expect(await continuity.localSellable(businessId, productId)).toBe(9);
    });
  });

  describe('a retried sync must not duplicate', () => {
    it('absorbs the same cloud booking once, however many times it is sent', async () => {
      const me = await register('cont-replay@e2e.test');
      const { roomId } = await makeHotelAndRoom(me.token, '301');
      const payload = {
        roomId, guestName: 'Online Guest', guestPhone: '0713000000',
        checkIn: '2027-02-01', checkOut: '2027-02-04', guestCount: 2,
      };

      const first = await continuity.absorbCloudBooking(me.id, 'cloud-booking-1', payload);
      const second = await continuity.absorbCloudBooking(me.id, 'cloud-booking-1', payload);
      const third = await continuity.absorbCloudBooking(me.id, 'cloud-booking-1', payload);

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(third.created).toBe(false);
      expect(second.booking.id).toBe(first.booking.id);

      const bookings = await ds.getRepository(HotelBooking).find({ where: { ownerId: me.id, roomId } });
      expect(bookings).toHaveLength(1);
    });

    it('survives two retries racing each other', async () => {
      const me = await register('cont-race@e2e.test');
      const { roomId } = await makeHotelAndRoom(me.token, '302');
      const payload = {
        roomId, guestName: 'Racing Guest', guestPhone: '0714000000',
        checkIn: '2027-03-01', checkOut: '2027-03-03',
      };

      const results = await Promise.all([
        continuity.absorbCloudBooking(me.id, 'cloud-booking-race', payload),
        continuity.absorbCloudBooking(me.id, 'cloud-booking-race', payload),
      ]);

      expect(results.filter((r) => r.created)).toHaveLength(1);
      const bookings = await ds.getRepository(HotelBooking).find({ where: { ownerId: me.id, roomId } });
      expect(bookings).toHaveLength(1);
    });

    it('records an outbox entry once per origin id', async () => {
      const me = await register('cont-outbox@e2e.test');
      const a = await continuity.recordOutbox(me.id, 'BOOKING', 'origin-7', { any: 'thing' });
      const b = await continuity.recordOutbox(me.id, 'BOOKING', 'origin-7', { any: 'thing' });
      expect(b.id).toBe(a.id);
      expect(await continuity.pendingOutbox(me.id)).toHaveLength(1);

      await continuity.markSynced(me.id, a.id);
      expect(await continuity.pendingOutbox(me.id)).toHaveLength(0);
    });
  });

  describe('cancellation returns capacity', () => {
    it('gives an unsold unit back without exceeding the original allotment', async () => {
      const me = await register('cont-cancel@e2e.test');
      const { businessId, productId } = await publishProduct(me.id, 6);
      await continuity.allocateProduct(me.id, { businessId, productId, qty: 2 });

      expect(await continuity.consumeProductAllowance(businessId, productId, 2)).toBe(true);
      await continuity.returnProductAllowance(businessId, productId, 1);

      const snippet = await ds.getRepository(ProductSnippet).findOneByOrFail({ businessId, productId });
      expect(snippet.remainingQty).toBe(1);

      // A replayed cancellation must not manufacture capacity.
      await continuity.returnProductAllowance(businessId, productId, 5);
      const after = await ds.getRepository(ProductSnippet).findOneByOrFail({ businessId, productId });
      expect(after.remainingQty).toBe(2);
    });
  });

  describe('reclaiming an allotment needs the cloud to acknowledge', () => {
    const WINDOW = { fromDate: '2027-04-01', toDate: '2027-04-10' };

    it('refuses a front-desk booking for allotted nights', async () => {
      const me = await register('cont-block@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '401');
      await continuity.grantRoom(me.id, { hotelId, roomId, ...WINDOW });

      const blocked = await reserve(me.token, roomId, '2027-04-03', '2027-04-05');
      expect(blocked.status).toBe(409);

      // Nights outside the window are still the operator's to sell.
      const allowed = await reserve(me.token, roomId, '2027-04-11', '2027-04-13');
      expect(allowed.status).toBe(201);
    });

    it('still refuses after a reclaim is requested but not acknowledged', async () => {
      const me = await register('cont-unacked@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '402');
      const allotment = await continuity.grantRoom(me.id, { hotelId, roomId, ...WINDOW });

      await continuity.requestReclaim(me.id, allotment.id);

      // Asking is not being told. The cloud may be mid-reservation.
      const stillBlocked = await reserve(me.token, roomId, '2027-04-03', '2027-04-05');
      expect(stillBlocked.status).toBe(409);
    });

    it('still refuses after the window has expired, until acknowledged', async () => {
      const me = await register('cont-expired@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '403');
      // A window entirely in the past.
      const allotment = await continuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2020-01-01', toDate: '2020-01-10',
      });

      const blocked = await reserve(me.token, roomId, '2020-01-02', '2020-01-04');
      expect(blocked.status).toBe(409);
      expect((await ds.getRepository(CloudRoomAllotment).findOneByOrFail({ id: allotment.id })).status).toBe('ACTIVE');
    });

    it('frees the nights once the cloud acknowledges the release', async () => {
      const me = await register('cont-acked@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '404');
      const allotment = await continuity.grantRoom(me.id, { hotelId, roomId, ...WINDOW });

      await continuity.requestReclaim(me.id, allotment.id);
      await continuity.acknowledgeRelease(me.id, allotment.id);

      const sold = await reserve(me.token, roomId, '2027-04-03', '2027-04-05');
      expect(sold.status).toBe(201);

      const released = await ds.getRepository(CloudRoomAllotment).findOneByOrFail({ id: allotment.id });
      expect(released.status).toBe('RELEASED');
      expect(released.acknowledgedAt).toBeTruthy();
    });

    it('treats a replayed acknowledgement as a no-op', async () => {
      const me = await register('cont-ackreplay@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '405');
      const allotment = await continuity.grantRoom(me.id, { hotelId, roomId, ...WINDOW });

      const once = await continuity.acknowledgeRelease(me.id, allotment.id);
      const twice = await continuity.acknowledgeRelease(me.id, allotment.id);
      expect(twice.acknowledgedAt?.toISOString()).toBe(once.acknowledgedAt?.toISOString());
    });

    it('will not allot nights the front desk has already sold', async () => {
      const me = await register('cont-sold@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '406');
      expect((await reserve(me.token, roomId, '2027-05-01', '2027-05-04')).status).toBe(201);

      await expect(continuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-05-02', toDate: '2027-05-06',
      })).rejects.toThrow();
    });

    it('will not allot the same nights twice', async () => {
      const me = await register('cont-double@e2e.test');
      const { hotelId, roomId } = await makeHotelAndRoom(me.token, '407');
      await continuity.grantRoom(me.id, { hotelId, roomId, ...WINDOW });

      await expect(continuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-04-05', toDate: '2027-04-20',
      })).rejects.toThrow();

      // Abutting windows are fine: [from, to) is half-open.
      await expect(continuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-04-10', toDate: '2027-04-20',
      })).resolves.toBeTruthy();
    });
  });
});
