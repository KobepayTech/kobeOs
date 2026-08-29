import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Kobe AI Receptionist — the restaurant flow end to end: greet → menu → take an
 * order (creates a real kitchen order) → order status → human hand-off (lead).
 * Runs without an LLM (deterministic engine); the LLM only enriches free-form
 * FAQ answers when configured.
 */
describe('AI Receptionist (e2e)', () => {
  let app: INestApplication;
  let http: import('http').Server;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('greets, takes a restaurant order, reports status, and hands off to a human', async () => {
    const reg = await request(http).post('/api/auth/register').send({ email: `resto_${Date.now()}@test.io`, password: 'secret123' });
    const token = reg.body.accessToken as string;
    const slug = `mama${Date.now().toString().slice(-6)}`;

    // A restaurant with a menu.
    const tenant = await request(http).post('/api/hotel/tenant').set(auth(token)).send({ slug, name: "Mama's Kitchen", currency: 'TZS' });
    const hotelId = tenant.body.id as string;
    await request(http).post('/api/hotel/menu-items').set(auth(token)).send({ name: 'Nyama Choma', category: 'Grill', price: 15000, available: true, station: 'kitchen', hotelId }).expect(201);
    await request(http).post('/api/hotel/menu-items').set(auth(token)).send({ name: 'Chips Mayai', category: 'Grill', price: 6000, available: true, station: 'kitchen', hotelId }).expect(201);

    // Configure the receptionist.
    const recp = await request(http).post('/api/reception').set(auth(token)).send({
      slug, businessName: "Mama's Kitchen", hotelId, handoffPhone: '+255700000000',
      hoursText: 'Open daily 10am–10pm, Kariakoo.',
      faq: [{ q: 'do you deliver delivery', a: 'Yes, we deliver within 5km.' }],
    });
    expect(recp.status).toBe(201);
    const receptionistId = recp.body.id as string;

    // Public profile exposes the menu.
    const profile = await request(http).get(`/api/reception-public/${slug}`);
    expect(profile.status).toBe(200);
    expect(profile.body.menu.map((m: { name: string }) => m.name)).toContain('Nyama Choma');

    const say = (text: string, sessionId?: string, customer?: { name?: string; phone?: string }) =>
      request(http).post(`/api/reception-public/${slug}/message`).send({ text, sessionId, customer });

    // FAQ.
    const faq = await say('do you deliver?');
    expect(faq.body.reply).toContain('deliver');
    const sessionId = faq.body.sessionId as string;

    // Menu + order.
    const menu = await say('can I see the menu', sessionId);
    expect(menu.body.reply).toContain('Nyama Choma');
    const add = await say('2 Nyama Choma and 1 Chips Mayai', sessionId);
    expect(add.body.cart).toHaveLength(2);

    // Checkout without contact → asks for it.
    const needContact = await say('done', sessionId);
    expect(needContact.body.intent).toBe('need_contact');

    // Provide contact → order placed (2×15000 + 1×6000 = 36000).
    const placed = await say('done', sessionId, { name: 'Juma', phone: '+255711111111' });
    expect(placed.body.order).toBeDefined();
    expect(Number(placed.body.order.total)).toBe(36000);

    // A real kitchen order exists.
    const orders = await request(http).get('/api/hotel/orders').set(auth(token));
    const list = Array.isArray(orders.body) ? orders.body : (orders.body.items ?? orders.body.orders ?? []);
    expect(list.some((o: { total: string | number }) => Number(o.total) === 36000)).toBe(true);

    // Status.
    const status = await say('where is my order?', sessionId, { phone: '+255711111111' });
    expect(status.body.reply.toLowerCase()).toContain('received');

    // Human hand-off → a lead is captured.
    const handoff = await say('I want to talk to a human please', sessionId);
    expect(handoff.body.handedOff).toBe(true);
    const leads = await request(http).get(`/api/reception/${receptionistId}/leads`).set(auth(token));
    expect(leads.body.length).toBeGreaterThanOrEqual(1);
  });
});
