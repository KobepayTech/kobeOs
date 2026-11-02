import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { KobeAgentService } from '../ai/agent.service';
import { BusinessBriefingService, BRIEFING_ENTITIES, checkedTimezone } from './business-briefing.service';
import { assertOwnerAction, ownerScope } from './business-scope';
import { PlatformEventsService } from '../platform/platform.service';
import { PlatformDomainEvent, PlatformBusinessSignal } from '../platform/platform.entity';
import { BusinessEventDeliveryService } from '../platform/business-event-delivery.service';
import { businessSignal, eventFingerprint, BusinessEventInput, BusinessEventName } from '../platform/business-events';
import { WarehouseItem, WarehouseMovement } from '../warehouse/warehouse.entity';
import { MovementsService } from '../warehouse/warehouse.service';
import { KpAccount, KpLedgerLine, KpTransaction } from '../kobepay-pro/kobepay-pro.entity';
import { LedgerService } from '../kobepay-pro/ledger.service';
import { AiApprovalRequest, AiOperatingAudit, AiWorkflowPlan } from '../ai/ai-operating.entity';
import { AiOperatingService } from '../ai/ai-operating.service';
import { PosOrder } from '../pos/pos.entity';
import { SharedBusinessFoundations1793600000000 } from '../migrations/1793600000000-SharedBusinessFoundations';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../auth/jwt.strategy';
import { BusinessFoundationsController } from './business-foundations.controller';
import request from 'supertest';
import { sign } from 'jsonwebtoken';

describe('business foundation policies', () => {
  it('does not treat administrator as cross-owner permission', () => {
    expect(() => ownerScope('one', 'admin', 'two')).toThrow();
    expect(ownerScope('one', 'user').identityModel).toBe('owner-account-v1');
  });
  it('denies missing identity and read-only action approval', () => {
    expect(() => ownerScope('', 'user')).toThrow();
    expect(() => assertOwnerAction('one', 'one', 'government_viewer')).toThrow();
  });
  it('validates timezone and refuses unknown or malformed events', () => {
    expect(checkedTimezone('Africa/Dar_es_Salaam')).toBe('Africa/Dar_es_Salaam');
    expect(() => checkedTimezone('invalid/time')).toThrow();
    expect(() => businessSignal('inventory.stock.changed', { quantity: NaN })).toThrow();
    expect(() => businessSignal('unknown' as BusinessEventName, { status: 'APPROVED' })).toThrow();
  });
  it('fingerprints the meaning of an event independently of object key order', () => {
    const base = { aggregateId: 'one', aggregateType: 'item', ownerId: 'owner', eventName: 'inventory.stock.changed' as const, idempotencyKey: 'event' };
    expect(eventFingerprint({ ...base, payload: { a: 1, b: 2 } }))
      .toBe(eventFingerprint({ ...base, payload: { b: 2, a: 1 } }));
  });
});

// Explicit opt-in. This suite can only reset its dedicated loopback test database.
const integration = process.env.FOUNDATION_TEST_PORT ? describe : describe.skip;
integration('shared foundations against isolated PostgreSQL', () => {
  let db: DataSource;
  let events: PlatformEventsService;
  let delivery: BusinessEventDeliveryService;
  const owner = randomUUID();
  const other = randomUUID();
  const input = (key = randomUUID()): BusinessEventInput => ({
    ownerId: owner, eventName: 'inventory.stock.changed', aggregateType: 'WarehouseItem',
    aggregateId: randomUUID(), idempotencyKey: key,
    payload: { itemId: randomUUID(), movementId: randomUUID(), previousQuantity: 9, quantity: 2, reorderLevel: 3 },
  });
  beforeAll(async () => {
    const port = Number(process.env.FOUNDATION_TEST_PORT);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid test port');
    db = new DataSource({ type: 'postgres', host: '127.0.0.1', port, username: process.env.FOUNDATION_TEST_USER || 'postgres',
      password: process.env.FOUNDATION_TEST_PASSWORD,
      database: 'kobeos_foundations_test', entities: [...new Set([...BRIEFING_ENTITIES,
        WarehouseMovement, KpAccount, KpLedgerLine, AiOperatingAudit, AiWorkflowPlan])],
      synchronize: true, dropSchema: true });
    await db.initialize();
    events = new PlatformEventsService(db.getRepository(PlatformDomainEvent));
    delivery = new BusinessEventDeliveryService(db);
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    for (const entity of [PlatformBusinessSignal, PlatformDomainEvent, WarehouseMovement, WarehouseItem,
      AiApprovalRequest, AiOperatingAudit, AiWorkflowPlan, KpLedgerLine, KpTransaction, KpAccount, PosOrder]) {
      await db.getRepository(entity).clear();
    }
  });

  it('applies and reverses the production migration, then applies it again', async () => {
    const q = db.createQueryRunner();
    await q.connect();
    try {
      const migration = new SharedBusinessFoundations1793600000000();
      await migration.down(q);
      await migration.up(q);
      await migration.up(q);
      expect(await q.hasTable('platform_business_signals')).toBe(true);
      expect(await q.hasColumn('ai_approval_requests', 'executionStatus')).toBe(true);
    } finally { await q.release(); }
  });
  it('rolls back source writes and their event together', async () => {
    await expect(db.transaction(async tx => {
      await tx.save(WarehouseItem, { ownerId: owner, sku: 'rollback', name: 'Rollback' });
      await events.recordInTransaction(tx, input());
      throw new Error('abort');
    })).rejects.toThrow('abort');
    expect(await db.getRepository(WarehouseItem).count()).toBe(0);
    expect(await db.getRepository(PlatformDomainEvent).count()).toBe(0);
    await expect(events.recordInTransaction(db.manager, input())).rejects.toThrow('active transaction');
  });
  it('deduplicates concurrent event recording, rejects changed payload and isolates owners', async () => {
    const event = input();
    await Promise.all(Array.from({ length: 4 }, () => db.transaction(tx => events.recordInTransaction(tx, event))));
    expect(await db.getRepository(PlatformDomainEvent).count()).toBe(1);
    await expect(db.transaction(tx => events.recordInTransaction(tx, { ...event, payload: { ...event.payload, quantity: 1 } }))).rejects.toThrow('different data');
    await db.transaction(tx => events.recordInTransaction(tx, { ...event, ownerId: other }));
    expect((await events.list(owner)).length).toBe(1);
    expect((await events.list(other)).length).toBe(1);
  });
  it('publishes each signal once under concurrent consumers and safe redelivery', async () => {
    await db.transaction(tx => events.recordInTransaction(tx, input()));
    await Promise.all(Array.from({ length: 4 }, () => delivery.deliverOne()));
    expect(await db.getRepository(PlatformBusinessSignal).count()).toBe(1);
    const event = await db.getRepository(PlatformDomainEvent).findOneByOrFail({ ownerId: owner });
    expect(event.status).toBe('PUBLISHED');
    await db.getRepository(PlatformDomainEvent).update(event.id, { status: 'RECORDED' });
    await delivery.deliverOne();
    expect(await db.getRepository(PlatformBusinessSignal).count()).toBe(1);
  });
  it('retains failed events with backoff, bounded attempts and recovery', async () => {
    const event = await db.transaction(tx => events.recordInTransaction(tx, input()));
    await db.getRepository(PlatformDomainEvent).update(event.id, { payload: {} });
    await delivery.deliverOne();
    let failed = await db.getRepository(PlatformDomainEvent).findOneByOrFail({ id: event.id });
    expect(failed.status).toBe('FAILED');
    expect(failed.attempts).toBe(1);
    expect(failed.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await delivery.deliverOne()).toBe(false);
    await db.getRepository(PlatformDomainEvent).update(event.id, { attempts: 8, nextAttemptAt: null });
    expect(await delivery.deliverOne()).toBe(false);
    await db.getRepository(PlatformDomainEvent).update(event.id, { attempts: 1, nextAttemptAt: null, payload: event.payload });
    await delivery.deliverOne();
    failed = await db.getRepository(PlatformDomainEvent).findOneByOrFail({ id: event.id });
    expect(failed.status).toBe('PUBLISHED');
  });
  it('serializes stock deductions and emits only one threshold crossing', async () => {
    const item = await db.getRepository(WarehouseItem).save({ ownerId: owner, sku: 'A1', name: 'Caps', quantity: 10, reorderLevel: 5 });
    const stock = new MovementsService(db.getRepository(WarehouseItem), db.getRepository(WarehouseMovement), db, events);
    await Promise.all([stock.record(owner, { itemId: item.id, type: 'OUT', quantity: 4 }), stock.record(owner, { itemId: item.id, type: 'OUT', quantity: 4 })]);
    expect((await db.getRepository(WarehouseItem).findOneByOrFail({ id: item.id })).quantity).toBe(2);
    expect(await db.getRepository(PlatformDomainEvent).countBy({ eventName: 'inventory.stock.low' })).toBe(1);
    await expect(stock.record(owner, { itemId: item.id, type: 'OUT', quantity: 3 })).rejects.toThrow('Insufficient');
    await expect(stock.record(other, { itemId: item.id, type: 'OUT', quantity: 1 })).rejects.toThrow('not found');
    expect(await db.getRepository(WarehouseMovement).count()).toBe(2);
  });
  it('records balanced ledger lines and an event in the same transaction', async () => {
    const ledger = new LedgerService(db.getRepository(KpAccount), db, events);
    const posting = (tx: EntityManager) => ledger.post(tx, { ownerId: owner, kind: 'DEPOSIT', amount: 25 }, [{ type: 'BANK', debit: 25 }, { type: 'STUDENT', refId: randomUUID(), credit: 25 }]);
    await db.transaction(posting);
    expect(await db.getRepository(KpLedgerLine).count()).toBe(2);
    expect(await db.getRepository(PlatformDomainEvent).countBy({ eventName: 'kobepay.ledger.posted' })).toBe(1);
    await expect(db.transaction(async tx => { await posting(tx); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect(await db.getRepository(KpTransaction).count()).toBe(1);
    await expect(db.transaction(tx => ledger.post(tx, { ownerId: owner, kind: 'DEPOSIT', amount: 25 }, [{ type: 'BANK', debit: 25 }, { type: 'STUDENT', credit: 24 }]))).rejects.toThrow('Unbalanced');
    await expect(db.transaction(tx => ledger.post(tx, { ownerId: owner, kind: 'DEPOSIT', amount: 25, currency: 'USD' }, [{ type: 'BANK', debit: 25 }, { type: 'STUDENT', credit: 25 }]))).rejects.toThrow('another currency');
    await expect(db.transaction(tx => ledger.post(tx, { ownerId: owner, kind: 'DEPOSIT', amount: NaN }, [{ type: 'BANK', debit: 25 }, { type: 'STUDENT', credit: 25 }]))).rejects.toThrow('finite');
  });
  const operating = (execute: jest.Mock, run?: jest.Mock) => new AiOperatingService(
    null!, null!, null!, db.getRepository(AiWorkflowPlan), db.getRepository(AiApprovalRequest),
    db.getRepository(AiOperatingAudit), null!, null!, null!, { execute, run } as unknown as KobeAgentService, db, events);
  it('clears forged chain decisions and executes a concurrently approved action once', async () => {
    const execute = jest.fn(async () => ({ ok: true, message: 'done' }));
    const ai = operating(execute);
    const approval = await ai.createApproval(owner, { actionType: 'test', summary: 'test', payload: { tool: 'test' }, chain: [{ role: 'user', label: 'Owner', status: 'APPROVED' }] });
    expect(approval.chain[0].status).toBe('PENDING');
    const results = await Promise.allSettled([ai.decideApproval(owner, approval.id, owner, 'user', 'approve'), ai.decideApproval(owner, approval.id, owner, 'user', 'approve')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect((await db.getRepository(AiApprovalRequest).findOneByOrFail({ id: approval.id })).executionStatus).toBe('COMPLETED');
    expect(await db.getRepository(PlatformDomainEvent).countBy({ eventName: 'ai.approval.decided' })).toBe(1);
  });
  it('denies cross-owner/readonly approvals and prevents automatic replay after uncertain failure', async () => {
    const execute = jest.fn(async () => { throw new Error('network lost'); });
    const ai = operating(execute);
    const approval = await ai.createApproval(owner, { actionType: 'test', summary: 'test', payload: { tool: 'test' } });
    await expect(ai.decideApproval(owner, approval.id, other, 'admin', 'approve')).rejects.toThrow();
    await expect(ai.decideApproval(owner, approval.id, owner, 'government_viewer', 'approve')).rejects.toThrow();
    const result = await ai.decideApproval(owner, approval.id, owner, 'user', 'approve');
    expect(result.request.executionStatus).toBe('FAILED');
    await expect(ai.decideApproval(owner, approval.id, owner, 'user', 'approve')).rejects.toThrow('already decided');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('claims a workflow once and carries the signed-in role to the agent', async () => {
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const run: jest.Mock = jest.fn(async () => { entered(); await blocked; return { reply: 'Verified result' }; });
    const ai = operating(jest.fn(), run);
    const plan = await db.getRepository(AiWorkflowPlan).save({ ownerId: owner, title: 'Review', objective: 'Review',
      status: 'DRAFT', steps: [{ id: 'read', title: 'Read', description: 'Review', type: 'READ', status: 'PENDING' }] });
    const first = ai.executeWorkflow(owner, plan.id, owner, 'user');
    await started;
    try { await expect(ai.executeWorkflow(owner, plan.id, owner, 'user')).rejects.toThrow('already running'); }
    finally { release(); }
    await first;
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][6]).toEqual({ role: 'user' });
    await expect(ai.approveWorkflow(owner, plan.id, owner, 'user')).rejects.toThrow('cannot be approved');
    expect((await db.getRepository(AiWorkflowPlan).findOneByOrFail({ id: plan.id })).executionClaim).toBeNull();
  });
  it('aggregates exact decimals by currency, excludes unfinished orders and other owners', async () => {
    const orders = db.getRepository(PosOrder);
    await orders.save([
      { ownerId: owner, orderNumber: 'one', total: 0.1, currency: 'USD', status: 'COMPLETED' },
      { ownerId: owner, orderNumber: 'two', total: 0.2, currency: 'USD', status: 'COMPLETED' },
      { ownerId: owner, orderNumber: 'tzs', total: 1000, currency: 'TZS', status: 'COMPLETED' },
      { ownerId: owner, orderNumber: 'pending', total: 999, currency: 'USD', status: 'PENDING' },
      { ownerId: other, orderNumber: 'private', total: 999, currency: 'USD', status: 'COMPLETED' },
    ]);
    const brain = new BusinessBriefingService(db);
    const snapshot = await brain.snapshot(owner, 'user', 'Africa/Dar_es_Salaam');
    expect(snapshot.completedOrdersToday.totals.find(r => r.currency === 'USD')?.total).toBe('0.3000');
    expect(snapshot.completedOrdersToday.totals.find(r => r.currency === 'TZS')?.total).toBe('1000.0000');
    expect(snapshot.rent.currency).toBeNull();
    await expect(brain.snapshot(owner, 'admin', 'UTC', other)).rejects.toThrow();
    expect((await brain.briefing(owner)).summary).toContain('completed order');
  });
  it('authenticates Brain routes and rejects cross-owner or invalid timezone requests', async () => {
    const secret = randomUUID() + randomUUID();
    const module = await Test.createTestingModule({
      imports: [PassportModule], controllers: [BusinessFoundationsController],
      providers: [JwtStrategy, { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: BusinessBriefingService, useValue: new BusinessBriefingService(db) }],
    }).compile();
    const app = module.createNestApplication();
    const previousDesktop = process.env.KOBEOS_DESKTOP;
    delete process.env.KOBEOS_DESKTOP;
    try {
      await app.init();
      const http = app.getHttpServer();
      const token = sign({ sub: owner, email: 'foundation@test.invalid', role: 'admin' }, secret, { expiresIn: 60 });
      await request(http).get('/brain/snapshot').expect(401);
      await request(http).get('/brain/snapshot').set('Authorization', 'Bearer invalid').expect(401);
      const response = await request(http).get('/brain/snapshot').set('Authorization', `Bearer ${token}`).expect(200);
      expect(response.body.scope.ownerId).toBe(owner);
      await request(http).get(`/brain/snapshot?ownerId=${other}`).set('Authorization', `Bearer ${token}`).expect(403);
      await request(http).get('/brain/briefing?timezone=invalid').set('Authorization', `Bearer ${token}`).expect(400);
    } finally {
      await app.close();
      if (previousDesktop === undefined) delete process.env.KOBEOS_DESKTOP;
      else process.env.KOBEOS_DESKTOP = previousDesktop;
    }
  });
});
