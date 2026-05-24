import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Per-user backup: export all of a user's owned data and import it into another
 * account, proving ids/relationships survive and ownership is reassigned.
 */
describe('Account export/import (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const token = async (email: string): Promise<string> => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    return r.body.accessToken as string;
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('exports a user\'s data and imports it into another account with references intact', async () => {
    const a = await token('export-a@e2e.test');

    // Create related rows: a todo list + an item that references it by id.
    const list = await request(http).post('/api/todo/lists').set(auth(a)).send({ name: 'Trip' });
    const listId = list.body.id as string;
    await request(http).post('/api/todo/items').set(auth(a)).send({ listId, text: 'Pack bags' });
    await request(http).post('/api/notes').set(auth(a)).send({ title: 'Idea', body: 'hello' });

    const dump = await request(http).get('/api/account/export').set(auth(a));
    expect(dump.status).toBe(200);
    expect(dump.body.data.todo_lists).toHaveLength(1);
    expect(dump.body.data.todo_items).toHaveLength(1);
    expect(dump.body.data.notes).toHaveLength(1);

    // Import into a fresh account.
    const b = await token('export-b@e2e.test');
    expect((await request(http).get('/api/todo/lists').set(auth(b))).body).toHaveLength(0);

    const imp = await request(http).post('/api/account/import').set(auth(b)).send(dump.body);
    expect(imp.status).toBe(201);
    expect(imp.body.ok).toBe(true);

    // B now owns the list, the note, and the item — and the item still points
    // at the same listId (reference preserved across the import).
    const bLists = await request(http).get('/api/todo/lists').set(auth(b));
    expect(bLists.body).toHaveLength(1);
    expect(bLists.body[0].id).toBe(listId);
    const bItems = await request(http).get(`/api/todo/items?listId=${listId}`).set(auth(b));
    expect(bItems.body).toHaveLength(1);
    expect(bItems.body[0].text).toBe('Pack bags');
    expect((await request(http).get('/api/notes').set(auth(b))).body).toHaveLength(1);
  });

  it('requires auth', async () => {
    expect((await request(http).get('/api/account/export')).status).toBe(401);
    expect((await request(http).post('/api/account/import')).status).toBe(401);
  });
});
