import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';
import { AiChatService } from '../src/ai/ai-chat.service';

/**
 * Until these existed KobeOS stored no chat history at all — the client
 * replayed its own and the conversation was gone on reload.
 *
 * Running the assistant needs a local model, which CI cannot provide, so
 * these drive the real AiChatService against the real database and check the
 * HTTP surface separately. That proves persistence rather than just proving
 * the routes are mounted.
 */
describe('Assistant conversations (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let chat: AiChatService;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    chat = app.get(AiChatService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return { token: r.body.accessToken as string, id: r.body.user.id as string };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('saves a turn and reads it back after the request is over', async () => {
    const me = await register('chat-save@e2e.test');

    const thread = await chat.openThread(me.id, undefined, 'How many rooms are free tonight?', 'kobe-hotel');
    await chat.append(me.id, thread.id, 'user', 'How many rooms are free tonight?');
    await chat.append(me.id, thread.id, 'assistant', 'Four rooms are free.', {
      model: 'kobechat', provider: 'ollama', promptTokens: 12, completionTokens: 5,
    });

    const res = await request(http).get(`/api/ai/chat/threads/${thread.id}`).set(auth(me.token));
    expect(res.status).toBe(200);
    expect(res.body.thread).toMatchObject({
      title: 'How many rooms are free tonight?',
      appId: 'kobe-hotel',
      messageCount: 2,
    });
    expect(res.body.thread.lastMessageAt).toBeTruthy();
    expect(res.body.messages.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ['user', 'How many rooms are free tonight?'],
      ['assistant', 'Four rooms are free.'],
    ]);
    expect(res.body.messages[1]).toMatchObject({ model: 'kobechat', provider: 'ollama', completionTokens: 5 });
  });

  it('replays saved turns as history, oldest first', async () => {
    const me = await register('chat-history@e2e.test');
    const thread = await chat.openThread(me.id, undefined, 'first', '');
    await chat.append(me.id, thread.id, 'user', 'first');
    await chat.append(me.id, thread.id, 'assistant', 'second');
    await chat.append(me.id, thread.id, 'user', 'third');

    expect(await chat.history(me.id, thread.id)).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ]);
  });

  it('keeps the newest turns when history is capped', async () => {
    const me = await register('chat-cap@e2e.test');
    const thread = await chat.openThread(me.id, undefined, 'start', '');
    for (let i = 0; i < 6; i += 1) await chat.append(me.id, thread.id, 'user', `m${i}`);

    const history = await chat.history(me.id, thread.id, 2);
    expect(history.length).toBe(4);
    expect(history[history.length - 1]).toEqual({ role: 'user', content: 'm5' });
  });

  it('lists newest first and hides archived until asked', async () => {
    const me = await register('chat-list@e2e.test');
    const older = await chat.openThread(me.id, undefined, 'older', '');
    await chat.append(me.id, older.id, 'user', 'older');
    const newer = await chat.openThread(me.id, undefined, 'newer', '');
    await chat.append(me.id, newer.id, 'user', 'newer');

    const listed = await request(http).get('/api/ai/chat/threads').set(auth(me.token));
    expect(listed.body.map((t: { id: string }) => t.id)).toEqual([newer.id, older.id]);

    await request(http).post(`/api/ai/chat/threads/${newer.id}/archive`).set(auth(me.token)).send({});
    const afterArchive = await request(http).get('/api/ai/chat/threads').set(auth(me.token));
    expect(afterArchive.body.map((t: { id: string }) => t.id)).toEqual([older.id]);

    const withArchived = await request(http).get('/api/ai/chat/threads?archived=true').set(auth(me.token));
    expect(withArchived.body.map((t: { id: string }) => t.id)).toEqual([newer.id, older.id]);
  });

  it('renames a conversation', async () => {
    const me = await register('chat-rename@e2e.test');
    const thread = await chat.openThread(me.id, undefined, 'original', '');
    const res = await request(http)
      .put(`/api/ai/chat/threads/${thread.id}`)
      .set(auth(me.token))
      .send({ title: 'Tonight\'s occupancy' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Tonight\'s occupancy');
  });

  it('deletes a conversation and its messages, leaving nothing orphaned', async () => {
    const me = await register('chat-delete@e2e.test');
    const thread = await chat.openThread(me.id, undefined, 'temporary', '');
    await chat.append(me.id, thread.id, 'user', 'temporary');

    const res = await request(http).delete(`/api/ai/chat/threads/${thread.id}`).set(auth(me.token));
    expect(res.status).toBe(200);

    expect((await request(http).get(`/api/ai/chat/threads/${thread.id}`).set(auth(me.token))).status).toBe(404);
    expect(await chat.history(me.id, thread.id)).toEqual([]);
  });

  it('never exposes or accepts another account\'s conversation', async () => {
    const mine = await register('chat-owner@e2e.test');
    const other = await register('chat-intruder@e2e.test');
    const thread = await chat.openThread(mine.id, undefined, 'private', '');
    await chat.append(mine.id, thread.id, 'user', 'private');

    const read = await request(http).get(`/api/ai/chat/threads/${thread.id}`).set(auth(other.token));
    expect(read.status).toBe(404);

    const renamed = await request(http)
      .put(`/api/ai/chat/threads/${thread.id}`).set(auth(other.token)).send({ title: 'mine now' });
    expect(renamed.status).toBe(404);

    const deleted = await request(http).delete(`/api/ai/chat/threads/${thread.id}`).set(auth(other.token));
    expect(deleted.status).toBe(404);

    // Continuing someone else's thread must fail rather than start a new one.
    await expect(chat.openThread(other.id, thread.id, 'hijack', '')).rejects.toThrow();

    // And the original is untouched.
    const still = await request(http).get(`/api/ai/chat/threads/${thread.id}`).set(auth(mine.token));
    expect(still.body.thread.title).toBe('private');
  });

  it('requires authentication', async () => {
    expect((await request(http).get('/api/ai/chat/threads')).status).toBe(401);
  });
});
