import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * KobeOS could send WhatsApp and link out to wa.me, but nothing came back —
 * a customer's reply landed nowhere. These cover the inbound half, including
 * the parts that face the public internet.
 */
describe('WhatsApp inbox (e2e)', () => {
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

  const webhookOf = async (token: string): Promise<string> => {
    const res = await request(http).get('/api/whatsapp/settings').set(auth(token));
    expect(res.status).toBe(200);
    return new URL(res.body.webhookUrl).pathname.replace(/^\/api/, '');
  };

  it('issues an absolute webhook URL with auto-reply off by default', async () => {
    const t = await register('wa-settings@e2e.test');
    const res = await request(http).get('/api/whatsapp/settings').set(auth(t));
    expect(res.body.autoReply).toBe(false);
    // The operator pastes this into Beem or Meta, so a relative path is useless.
    expect(() => new URL(res.body.webhookUrl)).not.toThrow();
    expect(res.body.webhookUrl).toContain('/api/whatsapp/webhook/');
  });

  it('accepts a customer message and opens a conversation', async () => {
    const t = await register('wa-inbound@e2e.test');
    const path = await webhookOf(t);

    const delivered = await request(http).post(`/api${path}`).send({
      msisdn: '0712345678', message: 'Bei ya sukari?', id: 'msg-1',
    });
    expect(delivered.status).toBe(201);
    expect(delivered.body).toMatchObject({ accepted: 1 });

    const contacts = await request(http).get('/api/whatsapp/contacts').set(auth(t));
    expect(contacts.body).toHaveLength(1);
    expect(contacts.body[0]).toMatchObject({ phone: '255712345678' });

    const convo = await request(http)
      .get(`/api/whatsapp/contacts/${contacts.body[0].id}`)
      .set(auth(t));
    expect(convo.body.messages.map((m: { direction: string; body: string }) => [m.direction, m.body]))
      .toEqual([['in', 'Bei ya sukari?']]);
  });

  it('ignores a redelivered message instead of duplicating it', async () => {
    const t = await register('wa-dupe@e2e.test');
    const path = await webhookOf(t);
    const payload = { msisdn: '255712345678', message: 'Habari', id: 'same-id' };

    await request(http).post(`/api${path}`).send(payload);
    await request(http).post(`/api${path}`).send(payload);

    const contacts = await request(http).get('/api/whatsapp/contacts').set(auth(t));
    const convo = await request(http).get(`/api/whatsapp/contacts/${contacts.body[0].id}`).set(auth(t));
    expect(convo.body.messages).toHaveLength(1);
  });

  it('records an opt-out and stops treating the customer as contactable', async () => {
    const t = await register('wa-optout@e2e.test');
    const path = await webhookOf(t);

    await request(http).post(`/api${path}`).send({ msisdn: '255712345678', message: 'Hi', id: 'a' });
    await request(http).post(`/api${path}`).send({ msisdn: '255712345678', message: 'ACHA', id: 'b' });

    const contacts = await request(http).get('/api/whatsapp/contacts').set(auth(t));
    expect(contacts.body[0].optedOut).toBe(true);
  });

  it('rejects an unknown webhook token', async () => {
    const res = await request(http)
      .post('/api/whatsapp/webhook/not-a-real-token')
      .send({ msisdn: '255712345678', message: 'hello' });
    expect(res.status).toBe(404);
  });

  it('rotating the token retires the old webhook URL', async () => {
    const t = await register('wa-rotate@e2e.test');
    const before = await webhookOf(t);

    await request(http).post('/api/whatsapp/settings/rotate-token').set(auth(t)).send({});
    const after = await webhookOf(t);
    expect(after).not.toBe(before);

    const old = await request(http).post(`/api${before}`).send({ msisdn: '255712345678', message: 'hi' });
    expect(old.status).toBe(404);
  });

  it('answers Meta\'s verification challenge', async () => {
    const t = await register('wa-verify@e2e.test');
    const path = await webhookOf(t);
    const res = await request(http).get(`/api${path}?hub.challenge=12345`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('12345');
  });

  it('keeps one shop\'s conversations away from another', async () => {
    const mine = await register('wa-owner@e2e.test');
    const other = await register('wa-other@e2e.test');
    const path = await webhookOf(mine);
    await request(http).post(`/api${path}`).send({ msisdn: '255712345678', message: 'private', id: 'p' });

    const mineList = await request(http).get('/api/whatsapp/contacts').set(auth(mine));
    expect(mineList.body).toHaveLength(1);

    const theirList = await request(http).get('/api/whatsapp/contacts').set(auth(other));
    expect(theirList.body).toEqual([]);

    const stolen = await request(http)
      .get(`/api/whatsapp/contacts/${mineList.body[0].id}`)
      .set(auth(other));
    expect(stolen.status).toBe(404);
  });

  it('requires authentication for the shop-facing routes', async () => {
    expect((await request(http).get('/api/whatsapp/settings')).status).toBe(401);
    expect((await request(http).get('/api/whatsapp/contacts')).status).toBe(401);
  });
});
