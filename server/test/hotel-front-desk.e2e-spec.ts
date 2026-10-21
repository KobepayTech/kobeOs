import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Reception check-in/check-out used to change screen state only, so a stay
 * disappeared as soon as the hotel app reloaded and re-synced. The endpoints
 * existed; the UI never called them, and GET /hotel/bookings returns roomId
 * and guestId — rows the front desk cannot render.
 *
 * These cover the joined view the reception screen now reads, and that a stay
 * survives being re-fetched.
 */
describe('Hotel front desk persistence (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const makeRoom = async (token: string, roomNumber: string) => {
    const r = await request(http).post('/api/hotel/rooms').set(auth(token))
      .send({ roomNumber, type: 'Double', rate: 50000, capacity: 2 });
    expect(r.status).toBe(201);
    return r.body.id as string;
  };

  const reserve = async (token: string, roomId: string, over: Record<string, unknown> = {}) =>
    request(http).post('/api/hotel/front-desk/reservations').set(auth(token)).send({
      roomId,
      guestName: 'Juma Mwinyi',
      guestPhone: '0712345678',
      guestEmail: 'juma@example.com',
      guestNationality: 'Tanzanian',
      guestIdNumber: 'ID-900',
      checkIn: '2026-11-01',
      checkOut: '2026-11-04',
      guestCount: 2,
      ...over,
    });

  it('returns a reception view the screen can actually render', async () => {
    const t = await register('fd-view@e2e.test');
    const roomId = await makeRoom(t, '101');
    const created = await reserve(t, roomId);
    expect(created.status).toBe(201);

    const listed = await request(http).get('/api/hotel/front-desk/reservations').set(auth(t));
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    // The fields the front desk needs, resolved server-side.
    expect(listed.body[0]).toMatchObject({
      roomNumber: '101',
      guestName: 'Juma Mwinyi',
      guestPhone: '0712345678',
      guestIdNumber: 'ID-900',
      checkIn: '2026-11-01',
      checkOut: '2026-11-04',
      guestCount: 2,
    });
    expect(listed.body[0].bookingId).toBeTruthy();
  });

  it('keeps a check-in after the screen re-fetches', async () => {
    const t = await register('fd-persist@e2e.test');
    const roomId = await makeRoom(t, '102');
    const created = await reserve(t, roomId);
    const bookingId = created.body.booking.id as string;

    const checkedIn = await request(http)
      .post(`/api/hotel/front-desk/bookings/${bookingId}/check-in`).set(auth(t)).send({});
    expect(checkedIn.status).toBe(201);

    // This is the reload the stay used to vanish on.
    const refetched = await request(http).get('/api/hotel/front-desk/reservations').set(auth(t));
    expect(refetched.body[0]).toMatchObject({ bookingId, status: 'CHECKED_IN', roomNumber: '102' });

    const rooms = await request(http).get('/api/hotel/rooms').set(auth(t));
    expect(rooms.body.find((r: { id: string }) => r.id === roomId).status).toBe('occupied');
  });

  it('checks out, frees the room for cleaning, and keeps the record', async () => {
    const t = await register('fd-out@e2e.test');
    const roomId = await makeRoom(t, '103');
    const created = await reserve(t, roomId);
    const bookingId = created.body.booking.id as string;
    await request(http).post(`/api/hotel/front-desk/bookings/${bookingId}/check-in`).set(auth(t)).send({});

    const out = await request(http)
      .post(`/api/hotel/front-desk/bookings/${bookingId}/check-out`).set(auth(t)).send({});
    expect(out.status).toBe(201);

    const refetched = await request(http).get('/api/hotel/front-desk/reservations').set(auth(t));
    expect(refetched.body[0]).toMatchObject({ bookingId, status: 'CHECKED_OUT' });
    const rooms = await request(http).get('/api/hotel/rooms').set(auth(t));
    expect(rooms.body.find((r: { id: string }) => r.id === roomId).status).toBe('cleaning');
  });

  it('refuses to check the same room in twice', async () => {
    const t = await register('fd-double@e2e.test');
    const roomId = await makeRoom(t, '104');
    const first = await reserve(t, roomId);
    await request(http).post(`/api/hotel/front-desk/bookings/${first.body.booking.id}/check-in`).set(auth(t)).send({});

    // An overlapping stay on an occupied room must not be accepted.
    const second = await reserve(t, roomId, { guestName: 'Second Guest' });
    if (second.status === 201) {
      const clash = await request(http)
        .post(`/api/hotel/front-desk/bookings/${second.body.booking.id}/check-in`).set(auth(t)).send({});
      expect(clash.status).toBeGreaterThanOrEqual(400);
    } else {
      expect(second.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('will not check out a stay that was never checked in', async () => {
    const t = await register('fd-notin@e2e.test');
    const roomId = await makeRoom(t, '105');
    const created = await reserve(t, roomId);

    const out = await request(http)
      .post(`/api/hotel/front-desk/bookings/${created.body.booking.id}/check-out`).set(auth(t)).send({});
    expect(out.status).toBeGreaterThanOrEqual(400);
  });

  it('shows one hotel nothing of another\'s', async () => {
    const mine = await register('fd-owner@e2e.test');
    const other = await register('fd-other@e2e.test');
    const roomId = await makeRoom(mine, '106');
    const created = await reserve(mine, roomId);

    const theirs = await request(http).get('/api/hotel/front-desk/reservations').set(auth(other));
    expect(theirs.body).toEqual([]);

    const stolen = await request(http)
      .post(`/api/hotel/front-desk/bookings/${created.body.booking.id}/check-in`).set(auth(other)).send({});
    expect(stolen.status).toBeGreaterThanOrEqual(400);
  });

  it('requires authentication', async () => {
    expect((await request(http).get('/api/hotel/front-desk/reservations')).status).toBe(401);
  });
});
