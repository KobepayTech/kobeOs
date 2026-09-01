import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Lala public network: every hotel with bookable rooms appears automatically
 * (no opt-in), and a hotel with an available menu can take standalone
 * pickup/delivery food orders straight onto its kitchen board.
 */
describe('Lala auto-listing + food ordering (e2e)', () => {
  let app: INestApplication;
  let http: import('http').Server;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return r.body.accessToken as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('lists a hotel that never opted in, and takes a food order when a menu exists', async () => {
    const token = await register(`lala_${Date.now()}@test.io`);
    const slug = `serena${Date.now().toString().slice(-6)}`;

    // Create a hotel + one available room. The owner does NOT create a Lala profile.
    const tenant = await request(http).post('/api/hotel/tenant').set(auth(token))
      .send({ slug, name: 'Serena Test Hotel', location: 'Dar es Salaam', currency: 'TZS' });
    expect(tenant.status).toBe(201);
    const hotelId = tenant.body.id as string;

    const room = await request(http).post('/api/hotel/rooms').set(auth(token))
      .send({ roomNumber: '101', type: 'Deluxe', rate: 80000, capacity: 2, status: 'available', hotelId });
    expect(room.status).toBe(201);

    // The hotel appears on the public Lala network with no opt-in, and no food yet.
    let search = await request(http).get('/api/lala-public/search');
    expect(search.status).toBe(200);
    let mine = (search.body as Array<{ hotel: { id: string }; foodAvailable: boolean }>).find((r) => r.hotel.id === hotelId);
    expect(mine).toBeDefined();
    expect(mine!.foodAvailable).toBe(false);

    // Add an available menu item → foodAvailable flips true.
    const item = await request(http).post('/api/hotel/menu-items').set(auth(token))
      .send({ name: 'Nyama Choma', category: 'Grill', price: 15000, available: true, station: 'kitchen', hotelId });
    expect(item.status).toBe(201);
    const menuItemId = item.body.id as string;

    search = await request(http).get('/api/lala-public/search');
    mine = (search.body as Array<{ hotel: { id: string }; foodAvailable: boolean }>).find((r) => r.hotel.id === hotelId);
    expect(mine!.foodAvailable).toBe(true);

    // The backup snapshot exposes only public hotel/room/menu data and is what
    // the independent Supabase path mirrors while primary production is healthy.
    const snapshot = await request(http).get('/api/lala-public/backup-snapshot');
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.version).toBe(1);
    expect(Array.isArray(snapshot.body.rows)).toBe(true);
    expect(Array.isArray(snapshot.body.menus)).toBe(true);
    expect(snapshot.body.rows.some((r: { hotel: { id: string } }) => r.hotel.id === hotelId)).toBe(true);
    expect(snapshot.body.menus.some((m: { hotelSlug: string; item: { id: string } }) => m.hotelSlug === slug && m.item.id === menuItemId)).toBe(true);

    // Public menu is visible, and a standalone pickup order lands (price is
    // taken from the catalog, not the request body).
    const menu = await request(http).get(`/api/public/hotel/${slug}/menu-items`);
    expect(menu.status).toBe(200);
    expect((menu.body as Array<{ id: string }>).some((m) => m.id === menuItemId)).toBe(true);

    const order = await request(http).post(`/api/public/hotel/${slug}/orders`).send({
      roomNumber: 'Pickup', locationType: 'pickup', guestName: 'Amina', guestPhone: '+255700000000',
      items: [{ menuItemId, name: 'Nyama Choma', qty: 2, price: 1, station: 'kitchen' }],
      currency: 'TZS', note: 'Pickup order via Lala',
    });
    expect(order.status).toBe(201);
    expect(order.body.status).toBe('PENDING');
    expect(Number(order.body.total)).toBe(30000); // 2 × catalog 15000, not the spoofed 1

    // A hidden hotel drops off the network.
    const hide = await request(http).patch(`/api/lala/hotels/${hotelId}/profile`).set(auth(token))
      .send({ hiddenFromLala: true });
    expect(hide.status).toBe(200);
    search = await request(http).get('/api/lala-public/search');
    expect((search.body as Array<{ hotel: { id: string } }>).find((r) => r.hotel.id === hotelId)).toBeUndefined();
  });

  it('exposes a database-backed health check and prevents overlapping public bookings', async () => {
    const token = await register(`lala_book_${Date.now()}@test.io`);
    const slug = `book${Date.now().toString().slice(-6)}`;
    const tenant = await request(http).post('/api/hotel/tenant').set(auth(token))
      .send({ slug, name: 'Lala Booking Hotel', location: 'Arusha', currency: 'TZS' });
    expect(tenant.status).toBe(201);
    const hotelId = tenant.body.id as string;
    const room = await request(http).post('/api/hotel/rooms').set(auth(token))
      .send({ roomNumber: 'A1', type: 'Suite', rate: 120000, capacity: 2, status: 'available', hotelId });
    expect(room.status).toBe(201);

    const health = await request(http).get('/api/lala-public/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.database).toBe('ready');
    expect(Number(health.body.bookableRoomCount)).toBeGreaterThanOrEqual(1);

    const passport = await request(http).post('/api/lala-public/passports')
      .send({ name: 'Asha Guest', phone: '+255700100200' });
    expect(passport.status).toBe(201);
    const passportToken = passport.body.passport.qrToken as string;

    const stay = {
      hotelId,
      roomId: room.body.id,
      passportToken,
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      guests: 2,
    };
    const first = await request(http).post('/api/lala-public/bookings').send(stay);
    expect(first.status).toBe(201);
    expect(first.body.booking.status).toBe('PENDING');

    const duplicate = await request(http).post('/api/lala-public/bookings').send(stay);
    expect(duplicate.status).toBe(409);

    const passportView = await request(http).get(`/api/lala-public/passports/${passportToken}`);
    expect(passportView.status).toBe(200);
    expect(passportView.body.activeBookings).toHaveLength(1);
    expect(passportView.body.activeBookings[0].hotelName).toBe('Lala Booking Hotel');
  });

  it('turns a hotel reverse offer into a real booking', async () => {
    const token = await register(`lala_offer_${Date.now()}@test.io`);
    const slug = `offer${Date.now().toString().slice(-6)}`;
    const tenant = await request(http).post('/api/hotel/tenant').set(auth(token))
      .send({ slug, name: 'Offer Hotel', location: 'Zanzibar', currency: 'TZS' });
    expect(tenant.status).toBe(201);
    const hotelId = tenant.body.id as string;
    const room = await request(http).post('/api/hotel/rooms').set(auth(token))
      .send({ roomNumber: 'B2', type: 'Ocean View', rate: 200000, capacity: 2, status: 'available', hotelId });
    expect(room.status).toBe(201);

    const profile = await request(http).patch(`/api/lala/hotels/${hotelId}/profile`).set(auth(token))
      .send({ reverseOffersEnabled: true, description: 'Ocean view rooms' });
    expect(profile.status).toBe(200);

    const passport = await request(http).post('/api/lala-public/passports')
      .send({ name: 'Neema Guest', phone: '+255700300400' });
    const passportToken = passport.body.passport.qrToken as string;

    const reverse = await request(http).post('/api/lala-public/reverse-requests').send({
      passportToken,
      destination: 'Zanzibar',
      checkIn: '2030-02-10',
      checkOut: '2030-02-12',
      guests: 2,
      budget: 350000,
      currency: 'TZS',
    });
    expect(reverse.status).toBe(201);
    const requestId = reverse.body.id as string;

    const ownerRequests = await request(http).get('/api/lala/reverse-requests').set(auth(token));
    expect(ownerRequests.status).toBe(200);
    expect(ownerRequests.body.some((row: { id: string }) => row.id === requestId)).toBe(true);

    const offered = await request(http).post(`/api/lala/reverse-requests/${requestId}/offers`).set(auth(token)).send({
      hotelId,
      roomId: room.body.id,
      totalPrice: 300000,
      currency: 'TZS',
      message: 'Breakfast included',
      expiresAt: '2030-02-01T12:00:00.000Z',
    });
    expect(offered.status).toBe(201);
    const offerId = offered.body.id as string;

    const offers = await request(http).get(`/api/lala-public/reverse-requests/${requestId}/offers`)
      .query({ passportToken });
    expect(offers.status).toBe(200);
    expect(offers.body).toHaveLength(1);
    expect(Number(offers.body[0].totalPrice)).toBe(300000);

    const accepted = await request(http).post(`/api/lala-public/reverse-requests/${requestId}/offers/${offerId}/accept`)
      .send({ passportToken });
    expect(accepted.status).toBe(201);
    expect(Number(accepted.body.booking.totalAmount)).toBe(300000);
    expect(accepted.body.hotel).toBe('Offer Hotel');

    const view = await request(http).get(`/api/lala-public/passports/${passportToken}`);
    expect(view.status).toBe(200);
    expect(view.body.activeBookings).toHaveLength(1);
    expect(Number(view.body.activeBookings[0].totalAmount)).toBe(300000);
  });

});
