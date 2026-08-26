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
});
