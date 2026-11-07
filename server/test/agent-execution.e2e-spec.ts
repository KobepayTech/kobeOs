import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';
import { AgentExecutionService } from '../src/ai/agent-execution.service';

/**
 * KobeOS recorded runs for scheduled agents but nothing for the interactive
 * assistant, so "what did it actually do" and "which tools fail" had no
 * answer. Driving the real service against the real database proves the
 * records land and stay scoped to their owner; asking the assistant a
 * question would need a local model CI cannot run.
 */
describe('Assistant tool executions (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let executions: AgentExecutionService;

  beforeAll(async () => {
    app = await bootTestApp();
    http = app.getHttpServer();
    executions = app.get(AgentExecutionService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const register = async (email: string) => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(r.status).toBe(201);
    return { token: r.body.accessToken as string, id: r.body.user.id as string };
  };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('starts empty', async () => {
    const me = await register('exec-empty@e2e.test');
    const res = await request(http).get('/api/ai/agent/executions').set(auth(me.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    const activity = await request(http).get('/api/ai/agent/activity').set(auth(me.token));
    expect(activity.body).toMatchObject({ runs: 0, failures: 0, failureRate: 0, tools: [] });
  });

  it('records a tool call and reports it as health', async () => {
    const me = await register('exec-record@e2e.test');
    await executions.record({
      ownerId: me.id, tool: 'sales_today', status: 'ok', startedAt: new Date(), durationMs: 120,
    });
    await executions.record({
      ownerId: me.id, tool: 'cargo_status', status: 'error', startedAt: new Date(), durationMs: 30,
      error: 'upstream unavailable',
    });

    const listed = await request(http).get('/api/ai/agent/executions').set(auth(me.token));
    expect(listed.body).toHaveLength(2);

    const activity = await request(http).get('/api/ai/agent/activity').set(auth(me.token));
    expect(activity.body).toMatchObject({ runs: 2, failures: 1, failureRate: 0.5 });
    expect(activity.body.tools[0]).toMatchObject({ tool: 'cargo_status', failures: 1 });
  });

  it('never lets recording break the tool it is watching', async () => {
    // A bad row must be swallowed, not thrown, or monitoring could take down
    // the assistant it exists to observe.
    await expect(executions.record({
      ownerId: 'not-a-uuid', tool: 'sales_today', status: 'ok', startedAt: new Date(), durationMs: 1,
    })).resolves.toBeUndefined();
  });

  it('truncates a long error rather than rejecting the row', async () => {
    const me = await register('exec-longerr@e2e.test');
    await executions.record({
      ownerId: me.id, tool: 'diagnose_system', status: 'error', startedAt: new Date(),
      durationMs: 5, error: 'x'.repeat(2000),
    });
    const listed = await request(http).get('/api/ai/agent/executions').set(auth(me.token));
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].error.length).toBe(500);
  });

  it('keeps each account\'s activity to itself', async () => {
    const mine = await register('exec-owner@e2e.test');
    const other = await register('exec-other@e2e.test');
    await executions.record({
      ownerId: mine.id, tool: 'unpaid_tenants', status: 'ok', startedAt: new Date(), durationMs: 10,
    });

    const theirs = await request(http).get('/api/ai/agent/executions').set(auth(other.token));
    expect(theirs.body).toEqual([]);
    const theirActivity = await request(http).get('/api/ai/agent/activity').set(auth(other.token));
    expect(theirActivity.body.runs).toBe(0);
  });

  it('requires authentication', async () => {
    expect((await request(http).get('/api/ai/agent/executions')).status).toBe(401);
    expect((await request(http).get('/api/ai/agent/activity')).status).toBe(401);
  });
});
