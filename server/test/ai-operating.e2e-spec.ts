import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

describe('Kobe AI operating layer (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const token = async (email: string): Promise<string> => {
    const response = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  };
  const bearer = (value: string) => ({ Authorization: `Bearer ${value}` });

  it('installs skill packs and keeps them owner-scoped', async () => {
    const a = await token('ai-skills-a@e2e.test');
    const b = await token('ai-skills-b@e2e.test');

    const installed = await request(http)
      .post('/api/ai/operating/skills/property-manager/install')
      .set(bearer(a))
      .send({ config: { arrearsFirst: true } });
    expect(installed.status).toBe(201);
    expect(installed.body.id).toBe('property-manager');
    expect(installed.body.installed).toBe(true);

    const aSkills = await request(http).get('/api/ai/operating/skills').set(bearer(a));
    const bSkills = await request(http).get('/api/ai/operating/skills').set(bearer(b));
    expect(aSkills.body.find((row: { id: string }) => row.id === 'property-manager').installed).toBe(true);
    expect(bSkills.body.find((row: { id: string }) => row.id === 'property-manager').installed).toBe(false);
  });

  it('stores structured company memory and relationships', async () => {
    const t = await token('ai-memory@e2e.test');
    const supplier = await request(http).post('/api/ai/operating/memory/nodes').set(bearer(t)).send({
      nodeType: 'supplier', externalKey: 'asha-foods', label: 'Asha Foods',
      attributes: { paymentDay: 'Friday' }, confidence: 1,
    });
    const shop = await request(http).post('/api/ai/operating/memory/nodes').set(bearer(t)).send({
      nodeType: 'shop', externalKey: 'shop-a', label: 'Shop A', attributes: { city: 'Dar es Salaam' },
    });
    expect(supplier.status).toBe(201);
    expect(shop.status).toBe(201);

    const link = await request(http).post('/api/ai/operating/memory/links').set(bearer(t)).send({
      fromNodeId: shop.body.id, relation: 'BUYS_FROM', toNodeId: supplier.body.id,
    });
    expect(link.status).toBe(201);

    const graph = await request(http).get('/api/ai/operating/memory?q=Asha').set(bearer(t));
    expect(graph.status).toBe(200);
    expect(graph.body.nodes.some((node: { label: string }) => node.label === 'Asha Foods')).toBe(true);
    expect(graph.body.edges).toHaveLength(1);
  });

  it('creates editable workflow plans and persists plan edits', async () => {
    const t = await token('ai-workflow@e2e.test');
    const created = await request(http).post('/api/ai/operating/workflows').set(bearer(t)).send({
      objective: 'Review outstanding rent and prepare a management report',
      context: { module: 'property' },
    });
    expect(created.status).toBe(201);
    expect(created.body.steps.length).toBeGreaterThanOrEqual(3);

    const steps = created.body.steps.map((step: Record<string, unknown>, index: number) => ({
      ...step,
      title: index === 0 ? 'Check arrears first' : step.title,
    }));
    const patched = await request(http).patch(`/api/ai/operating/workflows/${created.body.id}`).set(bearer(t)).send({
      objective: 'Review outstanding rent, starting with the oldest arrears',
      steps,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.steps[0].title).toBe('Check arrears first');
  });

  it('supports multi-stage approval chains', async () => {
    const t = await token('ai-approvals@e2e.test');
    const created = await request(http).post('/api/ai/operating/approvals').set(bearer(t)).send({
      actionType: 'purchase',
      summary: 'Approve stock purchase',
      amount: 500000,
      currency: 'TZS',
      payload: { reference: 'PO-99' },
      chain: [
        { role: 'user', label: 'Department manager' },
        { role: 'user', label: 'Finance review' },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.currentStep).toBe(0);

    const first = await request(http).post(`/api/ai/operating/approvals/${created.body.id}/decide`).set(bearer(t)).send({ decision: 'approve' });
    expect(first.status).toBe(201);
    expect(first.body.request.status).toBe('PENDING');
    expect(first.body.request.currentStep).toBe(1);

    const second = await request(http).post(`/api/ai/operating/approvals/${created.body.id}/decide`).set(bearer(t)).send({ decision: 'approve' });
    expect(second.status).toBe(201);
    expect(second.body.request.status).toBe('APPROVED');
  });

  it('generates dashboards and resolves widgets from live KobeOS data', async () => {
    const t = await token('ai-dashboard@e2e.test');
    const dashboard = await request(http).post('/api/ai/operating/dashboards').set(bearer(t)).send({
      prompt: 'Sales and expenses dashboard',
    });
    expect(dashboard.status).toBe(201);
    expect(dashboard.body.widgets.length).toBeGreaterThanOrEqual(2);

    const live = await request(http).get(`/api/ai/operating/dashboards/${dashboard.body.id}/live`).set(bearer(t));
    expect(live.status).toBe(200);
    expect(live.body.widgets).toHaveLength(dashboard.body.widgets.length);
    expect(live.body.widgets.every((widget: { summary?: string }) => typeof widget.summary === 'string')).toBe(true);
  });

  it('runs a business simulation and records operating audit events', async () => {
    const t = await token('ai-sim@e2e.test');
    const simulation = await request(http).post('/api/ai/operating/simulate').set(bearer(t)).send({
      salesChangePct: 10,
      expenseChangePct: -5,
      rentCollectionChangePct: 5,
      roomRateChangePct: 10,
    });
    expect(simulation.status).toBe(201);
    expect(simulation.body.confidence).toBe(0.65);
    expect(typeof simulation.body.projectedNet).toBe('number');

    const audit = await request(http).get('/api/ai/operating/audit').set(bearer(t));
    expect(audit.status).toBe(200);
    expect(audit.body.some((row: { eventType: string }) => row.eventType === 'BUSINESS_SIMULATION')).toBe(true);
  });
});
