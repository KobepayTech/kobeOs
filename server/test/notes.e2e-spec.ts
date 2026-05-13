import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

describe('Notes CRUD (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;

  beforeAll(async () => { app = await bootTestApp(); });
  afterAll(async () => { await app.close(); });

  beforeEach(async () => {
    await resetDb(app);
    const a = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'alice@e2e.test', password: 'wonderland' });
    token = a.body.accessToken;
    const b = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'bob@e2e.test', password: 'bobspass' });
    otherToken = b.body.accessToken;
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('creates, lists, updates and deletes a note', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/notes').set(auth())
      .send({ title: 'Hello', body: 'world', tags: ['x'] });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const list = await request(app.getHttpServer()).get('/api/notes').set(auth());
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const patch = await request(app.getHttpServer())
      .patch(`/api/notes/${id}`).set(auth())
      .send({ title: 'Updated' });
    expect(patch.status).toBe(200);
    expect(patch.body.title).toBe('Updated');
    expect(patch.body.body).toBe('world'); // untouched field preserved

    const del = await request(app.getHttpServer())
      .delete(`/api/notes/${id}`).set(auth());
    expect(del.status).toBe(200);

    const after = await request(app.getHttpServer()).get('/api/notes').set(auth());
    expect(after.body).toHaveLength(0);
  });

  it('owner-scoping: bob cannot see or modify alice\'s notes', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/notes').set(auth())
      .send({ title: 'Secret', body: 'classified' });
    const id = created.body.id;

    const bobList = await request(app.getHttpServer())
      .get('/api/notes').set('Authorization', `Bearer ${otherToken}`);
    expect(bobList.body).toHaveLength(0);

    const bobPatch = await request(app.getHttpServer())
      .patch(`/api/notes/${id}`).set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'hacked' });
    expect(bobPatch.status).toBe(404);

    const bobDelete = await request(app.getHttpServer())
      .delete(`/api/notes/${id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(bobDelete.status).toBe(404);
  });

  it('validates body via DTO (title too long → 400)', async () => {
    const tooLong = 'x'.repeat(500);
    const res = await request(app.getHttpServer())
      .post('/api/notes').set(auth())
      .send({ title: tooLong });
    expect(res.status).toBe(400);
  });
});
