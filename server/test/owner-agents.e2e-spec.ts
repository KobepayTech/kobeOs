import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { OwnerReportService } from '../src/ai/owner-report.service';
import { ScheduledAgentService } from '../src/ai/scheduled-agent.service';
import { AiScheduledAgent } from '../src/ai/scheduled-agent.entity';
import { ShopCashCount, ShopExpense } from '../src/eod/eod.entity';
import { ErpPurchaseOrder } from '../src/erp/supplier-capital.entity';
import { PosOrder, PosProduct } from '../src/pos/pos.entity';
import { Shop } from '../src/shops/shop.entity';
import { WarehouseItem } from '../src/warehouse/warehouse.entity';
import { bootTestApp, resetDb } from './setup';

describe('Shop owner agents', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: DataSource;
  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); db = app.get(DataSource); });
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { await resetDb(app); });

  async function account(email: string) {
    const login = await request(http).post('/api/auth/register').send({ email, password: 'test-secret123' }).expect(201);
    const headers = { Authorization: `Bearer ${login.body.accessToken}` };
    const profile = await request(http).get('/api/users/me').set(headers).expect(200);
    return { headers, ownerId: profile.body.id as string };
  }

  it('lists presets, creates one read-only schedule per owner, and executes it from the due queue', async () => {
    const owner = await account('owner-agent@example.test');
    const another = await account('other-agent@example.test');
    const metadata = await request(http).get('/api/ai/agents/metadata').set(owner.headers).expect(200);
    expect(metadata.body.ownerReports.map(report => report.key)).toEqual(['shop-close', 'stock-watch', 'margin-watch', 'incoming-watch']);

    await db.getRepository(PosProduct).save([
      { ownerId: owner.ownerId, sku: 'JEANS', name: 'Jeans', price: 25000, stock: 2, reservedStock: 1 },
      { ownerId: another.ownerId, sku: 'PRIVATE', name: 'Other owner stock', price: 5000, stock: 0 },
    ]);
    await db.getRepository(WarehouseItem).save({ ownerId: owner.ownerId, sku: 'BOX', name: 'Boxes', quantity: 4, reorderLevel: 6 });
    const payload = { reportKey: 'stock-watch', name: 'Stock watch', objective: 'Ignore the preset', frequency: 'DAILY',
      timezone: 'Africa/Dar_es_Salaam', allowedModules: ['hotel'], allowedTools: ['adjust_stock'],
      approvalMode: 'AUTOMATIC', outputDestination: 'SMS_OWNER' };
    const create = () => request(http).post('/api/ai/agents').set(owner.headers).send(payload).expect(201);
    const [first, retry] = await Promise.all([create(), create()]);
    expect(first.body.id).toBe(retry.body.id);
    expect(first.body).toMatchObject({ allowedModules: ['inventory', 'erp'], allowedTools: [], approvalMode: 'DRAFT_ONLY', outputDestination: 'KOBEOS_INBOX' });
    const id = first.body.id;
    await request(http).post(`/api/ai/agents/${id}/test`).set(another.headers).send({}).expect(404);
    const preview = await request(http).post(`/api/ai/agents/${id}/test`).set(owner.headers).send({ executeAutomaticAction: true }).expect(201);
    expect(preview.body.summary).toContain('Jeans (JEANS): 2 on hand, 1 reserved');
    expect(preview.body.summary).toContain('Boxes (BOX)');
    expect(preview.body.summary).not.toContain('Other owner stock');
    expect(preview.body.wasAutomaticAction).toBe(false);

    await db.getRepository(AiScheduledAgent).update(id, { nextRunAt: new Date(Date.now() - 60000) });
    await app.get(ScheduledAgentService).runDueAgents();
    const history = await request(http).get(`/api/ai/agents/${id}/runs`).set(owner.headers).expect(200);
    expect(history.body).toHaveLength(2);
    expect(history.body[0]).toMatchObject({ status: 'SUCCEEDED', result: { used: 'stock-watch' }, pendingAction: null });
    expect((await db.getRepository(PosProduct).findOneByOrFail({ ownerId: owner.ownerId })).stock).toBe(2);
  });

  it('uses the shop timezone for recorded sales and reports the latest till count and variance', async () => {
    const { ownerId } = await account('close-agent@example.test');
    const shop = await db.getRepository(Shop).save({ ownerId, name: 'Kariakoo' });
    const asOf = new Date('2026-11-07T22:30:00Z');
    await db.getRepository(PosOrder).save([
      { ownerId, orderNumber: 'OLD', status: 'COMPLETED', total: 40000, createdAt: new Date('2026-11-07T20:50:00Z') },
      { ownerId, orderNumber: 'TODAY', status: 'COMPLETED', total: 12000, createdAt: new Date('2026-11-07T21:30:00Z') },
      { ownerId, orderNumber: 'USD', status: 'COMPLETED', currency: 'USD', total: 20, createdAt: new Date('2026-11-07T21:40:00Z') },
      { ownerId, orderNumber: 'REFUND', status: 'REFUNDED', total: 50000, createdAt: new Date('2026-11-07T21:35:00Z') },
    ]);
    await db.getRepository(ShopExpense).save({ ownerId, shopId: shop.id, amount: 3000, createdAt: new Date('2026-11-07T22:00:00Z') });
    await db.getRepository(ShopCashCount).save([
      { ownerId, shopId: shop.id, tradingDate: '2026-11-08', expectedCash: 10000, countedCash: 9000, variance: -1000, closedAt: new Date('2026-11-07T22:10:00Z') },
      { ownerId, shopId: shop.id, tradingDate: '2026-11-08', expectedCash: 10000, countedCash: 9500, variance: -500, closedAt: new Date('2026-11-07T22:15:00Z') },
    ]);
    const report = await app.get(OwnerReportService).run(ownerId, 'shop-close', 'Africa/Dar_es_Salaam', asOf);
    expect(report.reply).toContain('2026-11-08');
    expect(report.reply).toContain('CASH: TZS 12,000');
    expect(report.reply).toContain('CASH: USD 20');
    expect(report.reply).toContain('cash: TZS 3,000');
    expect(report.reply).toContain('variance TZS -500');
    expect(report.reply).not.toMatch(/40,000|50,000|variance TZS -1,000/);
  });

  it('flags weak margins and overdue, due and undated orders with remaining quantities', async () => {
    const { ownerId } = await account('margin-agent@example.test');
    await db.getRepository(PosProduct).save([
      { ownerId, sku: 'LOW', name: 'Discount jeans', price: 9000, cost: 10000 },
      { ownerId, sku: 'MISSING', name: 'Unknown cost', price: 5000 },
      { ownerId, sku: 'ZERO', name: 'Unpriced stock', price: 0, cost: 1000 },
      { ownerId, sku: 'GOOD', name: 'Healthy item', price: 10000, cost: 5000 },
    ]);
    const orders = db.getRepository(ErpPurchaseOrder);
    const items = [{ name: 'Jeans', qty: 10, price: 10000, receivedQty: 4, damagedQty: 1 }];
    await orders.save([
      { ownerId, poNumber: 'LATE', expectedDate: new Date('2026-11-07'), items },
      { ownerId, poNumber: 'DUE', expectedDate: new Date('2026-11-12'), items },
      { ownerId, poNumber: 'UNDATED', items },
      { ownerId, poNumber: 'FUTURE', expectedDate: new Date('2026-12-01'), items },
      { ownerId, poNumber: 'RECEIVED', expectedDate: new Date('2026-11-01'), inventoryStatus: 'RECEIVED', items },
    ]);
    const reports = app.get(OwnerReportService);
    const asOf = new Date('2026-11-08T12:00:00Z');
    const margin = await reports.run(ownerId, 'margin-watch', 'Africa/Dar_es_Salaam', asOf);
    expect(margin.reply).toContain('Discount jeans (LOW)');
    expect(margin.reply).toContain('selling price is zero');
    expect(margin.reply).toContain('1 active product(s) missing a recorded cost');
    expect(margin.reply).not.toContain('Healthy item');
    const incoming = await reports.run(ownerId, 'incoming-watch', 'Africa/Dar_es_Salaam', asOf);
    expect(incoming.reply).toContain('Overdue (1)\nLATE · 2026-11-07: 5 units');
    expect(incoming.reply).toContain('Due within seven days (1)\nDUE');
    expect(incoming.reply).toContain('Missing ETA (1)\nUNDATED');
    expect(incoming.reply).not.toMatch(/FUTURE|RECEIVED/);
  });
});
