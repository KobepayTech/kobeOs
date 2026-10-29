import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { bootTestApp, resetDb } from './setup';
import { ContinuityService } from '../src/cloud-continuity/continuity.service';
import {
  ContinuitySyncService,
  type CatalogueSnapshot,
  type SyncTransport,
} from '../src/cloud-continuity/continuity-sync.service';
import { CloudOutboxRecord, CloudRoomAllotment } from '../src/cloud-continuity/continuity.entity';
import { ProductSnippet } from '../src/commerce/commerce.entity';
import { HotelBooking, HotelRoom, HotelTenant } from '../src/hotel/hotel.entity';

const SYNC_TOKEN = 'test-continuity-sync-token-at-least-32-chars';
process.env.CONTINUITY_SYNC_TOKEN = SYNC_TOKEN;

/**
 * Continuity sync across two separate databases.
 *
 * Two app instances on two PostgreSQL databases, because a single-database
 * test cannot show that a booking taken while the origin is unreachable
 * actually survives being handed over. The transport is in-process rather
 * than over HTTP — what is being proven is the replication and reconciliation
 * semantics, not the wire format, and the HTTP surface is covered separately
 * by the token tests below.
 */
describe('Continuity sync across two databases (e2e)', () => {
  const CLOUD_DB = 'kobeos_cloud_e2e';

  let origin: INestApplication;
  let cloud: INestApplication;
  let originDs: DataSource;
  let cloudDs: DataSource;
  let originSync: ContinuitySyncService;
  let cloudSync: ContinuitySyncService;
  let originContinuity: ContinuityService;
  let cloudContinuity: ContinuityService;
  let transport: SyncTransport;

  beforeAll(async () => {
    origin = await bootTestApp();
    originDs = origin.get(DataSource);

    // Create the cloud database from the origin's connection, then boot a
    // second instance against it. Its own migrations build the schema.
    const exists = await originDs.query('SELECT 1 FROM pg_database WHERE datname = $1', [CLOUD_DB]);
    if (!exists.length) await originDs.query(`CREATE DATABASE "${CLOUD_DB}"`);

    // Overridden by URL, not by DB_DATABASE: the first app's validated env
    // keeps DB_DATABASE for the rest of the process, so a second boot would
    // silently land on the same database — and then every assertion here
    // would pass for the wrong reason, since one database cannot show that a
    // booking survived being handed over. DATABASE_URL is unset in the test
    // env, so it falls through to process.env and actually takes effect.
    const url = `postgres://${process.env.DB_USERNAME ?? 'kobe'}:${process.env.DB_PASSWORD ?? 'kobe'}`
      + `@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? '5432'}/${CLOUD_DB}`;
    process.env.DATABASE_URL = url;
    process.env.DATABASE_URL_UNPOOLED = url;
    try {
      cloud = await bootTestApp();
    } finally {
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_URL_UNPOOLED;
    }
    cloudDs = cloud.get(DataSource);

    originSync = origin.get(ContinuitySyncService);
    cloudSync = cloud.get(ContinuitySyncService);
    originContinuity = origin.get(ContinuityService);
    cloudContinuity = cloud.get(ContinuityService);

    // The origin's view of the cloud. Separate databases, so anything that
    // crosses has to go through here.
    transport = {
      pushCatalogue: (snapshot: CatalogueSnapshot) =>
        cloudSync.applyCatalogueSnapshot(snapshot).then(() => undefined),
      pullOutbox: (limit: number) => cloudSync.pendingForPeer(limit),
      acknowledge: (ids: string[]) => cloudSync.acknowledgeForPeer(ids).then(() => undefined),
    };
  }, 240_000);

  afterAll(async () => {
    await cloud?.close();
    await origin?.close();
  });

  beforeEach(async () => {
    await resetDb(origin);
    await resetDb(cloud);
  });

  const register = async (app: INestApplication, email: string) => {
    const r = await request(app.getHttpServer()).post('/api/auth/register')
      .send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return { token: r.body.accessToken as string, id: r.body.user.id as string };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const hotelWithRoom = async (token: string, roomNumber: string) => {
    const http = origin.getHttpServer();
    const hotel = await request(http).post('/api/hotel/properties').set(auth(token))
      .send({ name: 'Continuity Hotel', slug: `sync-${roomNumber}`, currency: 'TZS' });
    expect(hotel.status).toBe(201);
    const room = await request(http).post('/api/hotel/rooms').set(auth(token))
      .send({ hotelId: hotel.body.id, roomNumber, type: 'Double', rate: 45000, capacity: 2 });
    expect(room.status).toBe(201);
    return { hotelId: hotel.body.id as string, roomId: room.body.id as string };
  };

  describe('the catalogue only carries what the cloud may sell', () => {
    it('omits rooms with no allotment', async () => {
      const me = await register(origin, 'sync-cat-none@e2e.test');
      await hotelWithRoom(me.token, '601');

      const snapshot = await originSync.buildCatalogueSnapshot();
      expect(snapshot.rooms).toHaveLength(0);
      expect(snapshot.allotments).toHaveLength(0);
    });

    it('includes a room once it is allotted, and carries no guest data', async () => {
      const me = await register(origin, 'sync-cat-one@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '602');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-08-01', toDate: '2027-08-10',
      });

      const snapshot = await originSync.buildCatalogueSnapshot();
      expect(snapshot.rooms.map((r) => r.id)).toEqual([roomId]);
      expect(snapshot.allotments).toHaveLength(1);
      expect(snapshot.hotels.map((h) => h.id)).toEqual([hotelId]);

      // No guest names, phones or identity documents cross the boundary.
      const serialised = JSON.stringify(snapshot);
      expect(serialised).not.toMatch(/guestName|guestPhone|guestIdNumber|passport/i);
    });

    it('drops a room again once the allotment is acknowledged as released', async () => {
      const me = await register(origin, 'sync-cat-released@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '603');
      const allotment = await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-09-01', toDate: '2027-09-05',
      });
      expect((await originSync.buildCatalogueSnapshot()).rooms).toHaveLength(1);

      await originContinuity.requestReclaim(me.id, allotment.id);
      // Still offered while the cloud has not confirmed.
      expect((await originSync.buildCatalogueSnapshot()).rooms).toHaveLength(1);

      await originContinuity.acknowledgeRelease(me.id, allotment.id);
      expect((await originSync.buildCatalogueSnapshot()).rooms).toHaveLength(0);
    });
  });

  describe('applying the catalogue', () => {
    it('lands rooms and allotments in the cloud database', async () => {
      const me = await register(origin, 'sync-apply@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '604');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-10-01', toDate: '2027-10-08',
      });

      await transport.pushCatalogue(await originSync.buildCatalogueSnapshot());

      const rooms = await cloudDs.getRepository(HotelRoom).find();
      const allotments = await cloudDs.getRepository(CloudRoomAllotment).find();
      // The hotel itself has to land first — slug is NOT NULL and unique, so
      // a snapshot that dropped it would fail the whole push.
      const hotels = await cloudDs.getRepository(HotelTenant).find();
      expect(hotels.map((h) => h.id)).toEqual([hotelId]);
      expect(hotels[0].slug).toBeTruthy();
      expect(rooms.map((r) => r.id)).toEqual([roomId]);
      expect(allotments).toHaveLength(1);
      expect(allotments[0].status).toBe('ACTIVE');
    });

    it('converges rather than accumulating when pushed repeatedly', async () => {
      const me = await register(origin, 'sync-apply-twice@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '605');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-11-01', toDate: '2027-11-04',
      });

      const snapshot = await originSync.buildCatalogueSnapshot();
      await transport.pushCatalogue(snapshot);
      await transport.pushCatalogue(snapshot);
      await transport.pushCatalogue(snapshot);

      expect(await cloudDs.getRepository(HotelRoom).count()).toBe(1);
      expect(await cloudDs.getRepository(CloudRoomAllotment).count()).toBe(1);
    });

    it('does not resurrect allowance the cloud has already spent', async () => {
      // The origin's snapshot says three remain. The cloud has since sold two.
      // Taking the origin's figure would offer those two again — the same
      // defect committedQty prevents locally, arriving over the wire.
      const businessId = '44444444-4444-4444-4444-444444444444';
      const productId = '55555555-5555-5555-5555-555555555555';
      const seed = (ds: DataSource, remaining: number, committed: number) => {
        const repo = ds.getRepository(ProductSnippet);
        return repo.save(repo.create({
          businessId, productId, catalogOwnerId: businessId, name: 'Wire Item',
          price: 2000, currency: 'TZS', stock: 10, active: true, indexedAt: new Date(),
          allocatedQty: 3, remainingQty: remaining, committedQty: committed,
        } as Partial<ProductSnippet>));
      };
      await seed(originDs, 3, 0);
      await seed(cloudDs, 1, 2);

      await transport.pushCatalogue(await originSync.buildCatalogueSnapshot());

      const after = await cloudDs.getRepository(ProductSnippet)
        .findOneByOrFail({ businessId, productId });
      expect(after.remainingQty).toBe(1);
      expect(after.committedQty).toBe(2);
      // Catalogue fields still update.
      expect(Number(after.stock)).toBe(10);
    });
  });

  describe('a booking taken on the cloud reaches the origin', () => {
    const bookingPayload = (roomId: string) => ({
      roomId, guestName: 'Online Guest', guestPhone: '0719000000',
      checkIn: '2027-12-01', checkOut: '2027-12-04', guestCount: 2,
    });

    it('crosses over, once, and is acknowledged', async () => {
      const me = await register(origin, 'sync-booking@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '606');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-12-01', toDate: '2027-12-10',
      });
      await transport.pushCatalogue(await originSync.buildCatalogueSnapshot());

      // The cloud takes a reservation while the origin is unreachable.
      await cloudContinuity.recordOutbox(me.id, 'BOOKING', 'wire-1', bookingPayload(roomId));
      expect(await cloudDs.getRepository(CloudOutboxRecord).count()).toBe(1);
      expect(await originDs.getRepository(HotelBooking).count()).toBe(0);

      const result = await originSync.runOnce(transport);

      expect(result).toMatchObject({ pulled: 1, absorbed: 1, failed: 0 });
      const bookings = await originDs.getRepository(HotelBooking).find();
      expect(bookings).toHaveLength(1);
      expect(bookings[0].cloudOriginId).toBe('wire-1');
      expect(bookings[0].status).toBe('CONFIRMED');
      // Pay at the merchant: the reservation is confirmed, no money captured.
      expect(Number(bookings[0].totalAmount)).toBe(0);

      const acked = await cloudDs.getRepository(CloudOutboxRecord).findOneByOrFail({ originId: 'wire-1' });
      expect(acked.syncedAt).toBeTruthy();
    });

    it('is not duplicated when the pass runs again', async () => {
      const me = await register(origin, 'sync-booking-twice@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '607');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-12-01', toDate: '2027-12-10',
      });
      await cloudContinuity.recordOutbox(me.id, 'BOOKING', 'wire-2', bookingPayload(roomId));

      await originSync.runOnce(transport);
      const second = await originSync.runOnce(transport);

      // Already acknowledged, so there is nothing left to hand over.
      expect(second.pulled).toBe(0);
      expect(await originDs.getRepository(HotelBooking).count()).toBe(1);
    });

    it('is not duplicated when the acknowledgement was lost', async () => {
      const me = await register(origin, 'sync-booking-lostack@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '608');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-12-01', toDate: '2027-12-10',
      });
      await cloudContinuity.recordOutbox(me.id, 'BOOKING', 'wire-3', bookingPayload(roomId));

      // The work lands but the acknowledgement never arrives, so the cloud
      // offers it again on the next pass. This is the case idempotent
      // absorption exists for.
      const lossy: SyncTransport = {
        ...transport,
        acknowledge: async () => { throw new Error('network dropped the ack'); },
      };
      const first = await originSync.runOnce(lossy);
      expect(first.absorbed).toBe(1);

      const second = await originSync.runOnce(transport);
      expect(second.pulled).toBe(1);
      expect(await originDs.getRepository(HotelBooking).count()).toBe(1);
    });

    it('still collects transactions when the catalogue push fails', async () => {
      const me = await register(origin, 'sync-cat-fail@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '609');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-12-01', toDate: '2027-12-10',
      });
      await cloudContinuity.recordOutbox(me.id, 'BOOKING', 'wire-4', bookingPayload(roomId));

      const brokenPush: SyncTransport = {
        ...transport,
        pushCatalogue: async () => { throw new Error('catalogue rejected'); },
      };
      const result = await originSync.runOnce(brokenPush);

      // Money already taken matters more than a stale catalogue.
      expect(result.cataloguePushed).toBe(false);
      expect(result.absorbed).toBe(1);
    });

    it('leaves an item it cannot absorb unacknowledged', async () => {
      const me = await register(origin, 'sync-unsupported@e2e.test');
      await cloudContinuity.recordOutbox(me.id, 'ALLOTMENT_RELEASE', 'wire-5', {});

      const result = await originSync.runOnce(transport);

      expect(result).toMatchObject({ pulled: 1, absorbed: 0, failed: 1 });
      // Evidence stays on the cloud rather than being dropped on the floor.
      const row = await cloudDs.getRepository(CloudOutboxRecord).findOneByOrFail({ originId: 'wire-5' });
      expect(row.syncedAt).toBeNull();
    });

    it('does not leave a live reservation when the cancellation arrives first', async () => {
      // Nothing orders the two, and a failed pass retries them independently,
      // so the cancellation can land first. The guest has cancelled either way.
      const me = await register(origin, 'sync-out-of-order@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '611');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-12-01', toDate: '2027-12-10',
      });

      await cloudContinuity.recordOutbox(me.id, 'CANCELLATION', 'wire-7', { reason: 'too early' });
      const first = await originSync.runOnce(transport);
      expect(first.absorbed).toBe(1);
      expect(await originDs.getRepository(HotelBooking).count()).toBe(0);

      await cloudContinuity.recordOutbox(me.id, 'BOOKING', 'wire-7', bookingPayload(roomId));
      await originSync.runOnce(transport);

      const booking = await originDs.getRepository(HotelBooking)
        .findOneByOrFail({ cloudOriginId: 'wire-7' });
      expect(booking.status).toBe('CANCELLED');

      // And the claim it was waiting on is settled, so the backlog is honest.
      const health = await originContinuity.syncHealth();
      expect(health).toMatchObject({ status: 'ok', pending: 0 });
    });

    it('carries a cancellation across and applies it once', async () => {
      const me = await register(origin, 'sync-cancel@e2e.test');
      const { hotelId, roomId } = await hotelWithRoom(me.token, '610');
      await originContinuity.grantRoom(me.id, {
        hotelId, roomId, fromDate: '2027-12-01', toDate: '2027-12-10',
      });
      await cloudContinuity.recordOutbox(me.id, 'BOOKING', 'wire-6', bookingPayload(roomId));
      await originSync.runOnce(transport);
      expect(await originDs.getRepository(HotelBooking).count()).toBe(1);

      // The guest cancels online. The cancellation is keyed on the booking.
      await cloudContinuity.recordOutbox(me.id, 'CANCELLATION', 'wire-6', { reason: 'changed plans' });
      const result = await originSync.runOnce(transport);

      expect(result.absorbed).toBe(1);
      const booking = await originDs.getRepository(HotelBooking)
        .findOneByOrFail({ cloudOriginId: 'wire-6' });
      expect(booking.status).toBe('CANCELLED');
    });
  });

  describe('an online order cancelled online', () => {
    it('returns its units and does not sit in the backlog afterwards', async () => {
      const me = await register(origin, 'sync-order-cancel@e2e.test');
      const businessId = me.id;
      const productId = '66666666-6666-6666-6666-666666666666';
      const repo = originDs.getRepository(ProductSnippet);
      await repo.save(repo.create({
        businessId, productId, catalogOwnerId: businessId, name: 'Cancelled Item',
        price: 1500, currency: 'TZS', stock: 8, active: true, indexedAt: new Date(),
        allocatedQty: 4, remainingQty: 1, committedQty: 3,
      } as Partial<ProductSnippet>));

      await cloudContinuity.recordOutbox(me.id, 'CANCELLATION', 'wire-order-1', {
        businessId, productId, qty: 2,
      });
      const result = await originSync.runOnce(transport);
      expect(result.absorbed).toBe(1);

      const after = await repo.findOneByOrFail({ businessId, productId });
      // Two units leave committed and return to the allowance, capped at the
      // allocation rather than inflating it.
      expect(after.committedQty).toBe(1);
      expect(after.remainingQty).toBe(3);

      // The applied claim is settled: an exception queue that reads as a
      // permanent critical backlog would train operators to ignore the alert.
      const health = await originContinuity.syncHealth();
      expect(health).toMatchObject({ status: 'ok', pending: 0 });
    });

    it('returns the units once even when the pass repeats', async () => {
      const me = await register(origin, 'sync-order-cancel-twice@e2e.test');
      const businessId = me.id;
      const productId = '77777777-7777-7777-7777-777777777777';
      const repo = originDs.getRepository(ProductSnippet);
      await repo.save(repo.create({
        businessId, productId, catalogOwnerId: businessId, name: 'Replayed Item',
        price: 1500, currency: 'TZS', stock: 8, active: true, indexedAt: new Date(),
        allocatedQty: 4, remainingQty: 1, committedQty: 3,
      } as Partial<ProductSnippet>));

      await cloudContinuity.recordOutbox(me.id, 'CANCELLATION', 'wire-order-2', {
        businessId, productId, qty: 2,
      });
      const lossy: SyncTransport = {
        ...transport,
        acknowledge: async () => { throw new Error('ack lost'); },
      };
      await originSync.runOnce(lossy);
      await originSync.runOnce(transport);

      const after = await repo.findOneByOrFail({ businessId, productId });
      expect(after.committedQty).toBe(1);
      expect(after.remainingQty).toBe(3);
    });
  });

  describe('the sync endpoints require the machine token', () => {
    const http = () => cloud.getHttpServer();

    it('refuses an unauthenticated pull', async () => {
      expect((await request(http()).get('/api/continuity/outbox')).status).toBe(401);
    });

    it('refuses a wrong token', async () => {
      const res = await request(http()).get('/api/continuity/outbox')
        .set({ 'x-continuity-token': 'not-the-token-but-the-same-length-ish' });
      expect(res.status).toBe(401);
    });

    it('accepts the configured token', async () => {
      const res = await request(http()).get('/api/continuity/outbox')
        .set({ 'x-continuity-token': SYNC_TOKEN });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('refuses to accept a catalogue without the token', async () => {
      const res = await request(http()).post('/api/continuity/catalogue').send({ rooms: [] });
      expect(res.status).toBe(401);
    });

    it('does not require a user JWT once the machine token is present', async () => {
      const res = await request(http()).post('/api/continuity/outbox/ack')
        .set({ 'x-continuity-token': SYNC_TOKEN })
        .send({ ids: [] });
      expect(res.status).toBe(201);
      expect(res.body.acknowledged).toBe(0);
    });
  });
});
