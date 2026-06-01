import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootTestApp, resetDb } from './setup';

/**
 * Coverage for the modules added on top of the original schema (print, admin,
 * devops, erp + the /erp/summary aggregation), plus the cross-cutting
 * per-user ownership guarantee that all of them inherit from OwnedCrudService.
 */
describe('New modules + ownership (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => { app = await bootTestApp(); http = app.getHttpServer(); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(app); });

  const token = async (email: string): Promise<string> => {
    const r = await request(http).post('/api/auth/register').send({ email, password: 'secret123' });
    return r.body.accessToken as string;
  };
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('CRUD round-trips across print / admin / devops / erp', async () => {
    const t = await token('crud@e2e.test');

    const job = await request(http).post('/api/print/jobs').set(bearer(t))
      .send({ product: 'Corporate Polo', customer: 'CRDB', qty: 25, priority: 'High' });
    expect(job.status).toBe(201);
    expect(job.body.status).toBe('Pending'); // server default

    const patched = await request(http).patch(`/api/print/jobs/${job.body.id}`).set(bearer(t))
      .send({ status: 'Completed' });
    expect(patched.body.status).toBe('Completed');

    const company = await request(http).post('/api/admin/companies').set(bearer(t))
      .send({ name: 'Acme', plan: 'Pro', revenue: 1000 });
    expect(company.status).toBe(201);

    const list = await request(http).get('/api/admin/companies').set(bearer(t));
    expect(list.body).toHaveLength(1);

    const del = await request(http).delete(`/api/print/jobs/${job.body.id}`).set(bearer(t));
    expect(del.status).toBe(200);
    expect((await request(http).get('/api/print/jobs').set(bearer(t))).body).toHaveLength(0);
  });

  it('persists nested JSON: devops issue comments & erp PO items', async () => {
    const t = await token('nested@e2e.test');

    const issue = await request(http).post('/api/devops/issues').set(bearer(t))
      .send({ title: 'API timeout', priority: 'High', comments: [{ author: 'Rajab', text: 'investigating', date: '2026-01-01' }] });
    expect(issue.status).toBe(201);
    expect(issue.body.comments[0].text).toBe('investigating');

    const po = await request(http).post('/api/erp/purchase-orders').set(bearer(t))
      .send({ poNumber: 'PO-1', supplier: 'China Co', items: [{ name: 'Widget', qty: 2, price: 25000 }] });
    expect(po.status).toBe(201);
    expect(po.body.items[0].qty).toBe(2);

    // survives a re-fetch (round-trips through the DB column, not just the echo)
    const refetched = await request(http).get('/api/erp/purchase-orders').set(bearer(t));
    expect(refetched.body[0].items[0].name).toBe('Widget');
  });

  it('enforces per-user ownership isolation', async () => {
    const a = await token('owner-a@e2e.test');
    const b = await token('owner-b@e2e.test');

    const mine = await request(http).post('/api/print/jobs').set(bearer(a)).send({ product: 'Secret Job' });
    const id = mine.body.id as string;

    // B cannot see A's row
    const bList = await request(http).get('/api/print/jobs').set(bearer(b));
    expect(bList.body).toHaveLength(0);

    // B cannot mutate or delete A's row -> 404 (not 403, to avoid leaking existence)
    expect((await request(http).patch(`/api/print/jobs/${id}`).set(bearer(b)).send({ status: 'Completed' })).status).toBe(404);
    expect((await request(http).delete(`/api/print/jobs/${id}`).set(bearer(b))).status).toBe(404);

    // A is unaffected
    expect((await request(http).get('/api/print/jobs').set(bearer(a))).body).toHaveLength(1);
  });

  it('/erp/summary aggregates the caller\'s POS data', async () => {
    const t = await token('summary@e2e.test');
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'S1', name: 'Item', price: 1000, stock: 10 });
    await request(http).post('/api/pos/orders').set(bearer(t))
      .send({ orderNumber: 'O1', lines: [{ productId: product.body.id, quantity: 3 }] });

    const summary = await request(http).get('/api/erp/summary').set(bearer(t));
    expect(summary.status).toBe(200);
    expect(summary.body.kpis.revenue).toBe(3000);
    expect(summary.body.kpis.orders).toBe(1);
    expect(summary.body.accounts.monthlyTrend).toHaveLength(6);
  });

  it('POS sale returns receipt + pick ticket and deducts warehouse stock', async () => {
    const t = await token('pos-slice@e2e.test');

    // Warehouse item with the same SKU as the product gets deducted via OUT movement.
    await request(http).post('/api/warehouse/items').set(bearer(t))
      .send({ sku: 'SKU-RICE', name: 'Rice 5kg', quantity: 50, unit: 'bag', location: 'A2' });
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'SKU-RICE', name: 'Rice 5kg', price: 12000, stock: 50 });

    const sale = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-1001',
      lines: [{ productId: product.body.id, quantity: 3 }],
      customerName: 'Juma Abdallah',
      paymentMethod: 'CASH',
    });
    expect(sale.status).toBe(201);
    expect(sale.body.total).toBe(36000);
    expect(sale.body.receipt.text).toContain('SO-1001');
    expect(sale.body.receipt.text).toContain('Rice 5kg');
    expect(sale.body.receipt.text).toContain('TOTAL');
    expect(sale.body.pickTicket.ticketNumber).toBe('PT-SO-1001');
    expect(sale.body.pickTicket.status).toBe('PENDING');
    expect(sale.body.pickTicket.items).toHaveLength(1);
    expect(sale.body.pickTicket.items[0].sku).toBe('SKU-RICE');
    expect(sale.body.pickTicket.items[0].location).toBe('A2');

    // Warehouse stock decremented from 50 to 47 via OUT movement.
    const items = await request(http).get('/api/warehouse/items').set(bearer(t));
    expect(items.body[0].quantity).toBe(47);
    const moves = await request(http).get('/api/warehouse/movements').set(bearer(t));
    expect(moves.body[0].type).toBe('OUT');
    expect(moves.body[0].reference).toBe('PT-SO-1001');

    // Status flow: PENDING -> PICKING -> PACKED -> DISPATCHED.
    const ticketId = sale.body.pickTicket.id as string;
    const picking = await request(http).patch(`/api/warehouse/pick-tickets/${ticketId}/status`)
      .set(bearer(t)).send({ status: 'PICKING', pickedBy: 'Asha' });
    expect(picking.body.status).toBe('PICKING');
    const packed = await request(http).patch(`/api/warehouse/pick-tickets/${ticketId}/status`)
      .set(bearer(t)).send({ status: 'PACKED' });
    expect(packed.body.status).toBe('PACKED');
    const dispatched = await request(http).patch(`/api/warehouse/pick-tickets/${ticketId}/status`)
      .set(bearer(t)).send({ status: 'DISPATCHED' });
    expect(dispatched.body.status).toBe('DISPATCHED');

    // Illegal transition (DISPATCHED is terminal) -> 400.
    const bad = await request(http).patch(`/api/warehouse/pick-tickets/${ticketId}/status`)
      .set(bearer(t)).send({ status: 'PICKING' });
    expect(bad.status).toBe(400);
  });

  it('POS sale applies coupon + percentage rule and bumps coupon usage', async () => {
    const t = await token('discount@e2e.test');

    await request(http).post('/api/discounts/rules').set(bearer(t))
      .send({ name: 'Loyalty 5%', type: 'Percentage', value: 5 });
    const coupon = await request(http).post('/api/discounts/coupons').set(bearer(t))
      .send({ code: 'WELCOME10', type: 'Percentage', value: 10, usageLimit: 5 });

    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'SKU-DRINK', name: 'Cola', price: 1000, stock: 100 });

    const sale = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-D1',
      lines: [{ productId: product.body.id, quantity: 10 }],
      couponCode: 'WELCOME10',
    });
    expect(sale.status).toBe(201);
    // 10000 subtotal - 5% rule (500) - 10% coupon (1000) = 8500.
    expect(sale.body.discountAmount).toBe(1500);
    expect(sale.body.total).toBe(8500);
    expect(sale.body.discount.breakdown).toHaveLength(2);

    // Coupon usage was incremented.
    const coupons = await request(http).get('/api/discounts/coupons').set(bearer(t));
    const refreshed = coupons.body.find((c: { id: string }) => c.id === coupon.body.id);
    expect(refreshed.usageCount).toBe(1);
  });

  it('rejects discount > 20% threshold without approval, accepts with approvedBy', async () => {
    const t = await token('approval@e2e.test');
    await request(http).post('/api/discounts/rules').set(bearer(t))
      .send({ name: 'Clearance', type: 'Percentage', value: 30 });
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'SKU-X', name: 'Item', price: 1000, stock: 10 });

    const denied = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-A1',
      lines: [{ productId: product.body.id, quantity: 1 }],
    });
    expect(denied.status).toBe(403);

    const approved = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-A2',
      lines: [{ productId: product.body.id, quantity: 1 }],
      approvedBy: 'manager-asha',
    });
    expect(approved.status).toBe(201);
    expect(approved.body.total).toBe(700);
  });

  it('BNPL sale creates receivable, decrements available credit, accepts payment', async () => {
    const t = await token('bnpl@e2e.test');

    await request(http).post('/api/credit/profiles').set(bearer(t)).send({
      customerPhone: '+255700000001',
      customerName: 'Juma Abdallah',
      creditLimit: 500000,
      riskGrade: 'B',
    });

    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'SKU-TV', name: 'TV', price: 300000, stock: 5 });

    const sale = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-BNPL-1',
      lines: [{ productId: product.body.id, quantity: 1 }],
      customerName: 'Juma Abdallah',
      customerPhone: '+255700000001',
      paymentMethod: 'BNPL',
      installmentMonths: 3,
    });
    expect(sale.status).toBe(201);
    expect(sale.body.isBnpl).toBe(true);
    expect(sale.body.receivable.amount).toBe(300000);
    expect(sale.body.receivable.installmentMonths).toBe(3);
    expect(sale.body.receivable.monthlyAmount).toBe(100000);

    const profile = await request(http).get('/api/credit/profiles/by-phone/+255700000001').set(bearer(t));
    expect(profile.body.outstanding).toBe(300000);
    expect(profile.body.availableCredit).toBe(200000);

    // Second BNPL purchase exceeding remaining limit is rejected.
    const denied = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-BNPL-2',
      lines: [{ productId: product.body.id, quantity: 1 }],
      customerPhone: '+255700000001',
      paymentMethod: 'BNPL',
    });
    expect(denied.status).toBe(400);
    expect(denied.body.message).toMatch(/BNPL denied/);

    // Partial payment recorded.
    const receivableId = sale.body.receivable.id as string;
    const paid = await request(http).patch(`/api/credit/receivables/${receivableId}/pay`).set(bearer(t))
      .send({ amount: 100000 });
    expect(paid.body.status).toBe('PARTIAL');
    expect(paid.body.paid).toBe(100000);

    const after = await request(http).get('/api/credit/profiles/by-phone/+255700000001').set(bearer(t));
    expect(after.body.outstanding).toBe(200000);
    expect(after.body.availableCredit).toBe(300000);
  });

  it('BNPL without a credit profile is rejected', async () => {
    const t = await token('bnpl-noprofile@e2e.test');
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'SKU-N', name: 'Item', price: 1000, stock: 10 });
    const r = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-NP',
      lines: [{ productId: product.body.id, quantity: 1 }],
      customerPhone: '+255000000000',
      paymentMethod: 'BNPL',
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/No credit profile/);
  });

  it('multi-warehouse: items auto-attach to default, can be scoped to a specific warehouse', async () => {
    const t = await token('multiwh@e2e.test');

    // First item create with no warehouseId -> default "Main" warehouse is auto-created.
    const item1 = await request(http).post('/api/warehouse/items').set(bearer(t))
      .send({ sku: 'SKU-A', name: 'Item A', quantity: 10 });
    expect(item1.status).toBe(201);
    expect(item1.body.warehouseId).toBeTruthy();
    const defaultWhId = item1.body.warehouseId as string;

    const whs = await request(http).get('/api/warehouse/warehouses').set(bearer(t));
    expect(whs.body).toHaveLength(1);
    expect(whs.body[0].isDefault).toBe(true);
    expect(whs.body[0].code).toBe('MAIN');

    // Add an Arusha warehouse and an item scoped to it.
    const arusha = await request(http).post('/api/warehouse/warehouses').set(bearer(t))
      .send({ code: 'ARU', name: 'Arusha', location: 'Arusha' });
    expect(arusha.status).toBe(201);
    const item2 = await request(http).post('/api/warehouse/items').set(bearer(t))
      .send({ sku: 'SKU-B', name: 'Item B', quantity: 5, warehouseId: arusha.body.id });
    expect(item2.body.warehouseId).toBe(arusha.body.id);

    // Filter by warehouse.
    const inMain = await request(http).get(`/api/warehouse/items?warehouseId=${defaultWhId}`).set(bearer(t));
    expect(inMain.body).toHaveLength(1);
    expect(inMain.body[0].sku).toBe('SKU-A');
    const inAru = await request(http).get(`/api/warehouse/items?warehouseId=${arusha.body.id}`).set(bearer(t));
    expect(inAru.body).toHaveLength(1);
    expect(inAru.body[0].sku).toBe('SKU-B');

    // Default warehouse cannot be deleted.
    const delDefault = await request(http).delete(`/api/warehouse/warehouses/${defaultWhId}`).set(bearer(t));
    expect(delDefault.status).toBe(400);

    // POS sale of an item routes the pick ticket to that item's warehouse.
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'SKU-B', name: 'Item B', price: 5000, stock: 5 });
    const sale = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-MWH-1',
      lines: [{ productId: product.body.id, quantity: 1 }],
    });
    expect(sale.body.pickTicket.warehouseId).toBe(arusha.body.id);
  });

  it('POS sale auto-posts a balanced double-entry to the GL', async () => {
    const t = await token('je@e2e.test');
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'JE-1', name: 'Item', price: 1000, stock: 10 });

    const sale = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-JE-1',
      lines: [{ productId: product.body.id, quantity: 5 }],
      taxAmount: 100,
    });
    expect(sale.status).toBe(201);
    expect(sale.body.total).toBe(5100);
    expect(Array.isArray(sale.body.journal)).toBe(true);

    // Lines posted: DR Cash 5100, CR Revenue 5000, CR Tax 100.
    const journal = await request(http).get('/api/erp/journal').set(bearer(t));
    expect(journal.body).toHaveLength(3);
    const totalDr = journal.body.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0);
    const totalCr = journal.body.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0);
    expect(totalDr).toBe(totalCr);
    expect(totalDr).toBe(5100);

    // Chart of accounts bootstrapped and balances updated.
    const accounts = await request(http).get('/api/erp/accounts').set(bearer(t));
    expect(accounts.body.length).toBeGreaterThanOrEqual(7);
    const byCode = Object.fromEntries(accounts.body.map((a: { code: string }) => [a.code, a]));
    expect(Number(byCode['1000'].balance)).toBe(5100); // Cash
    expect(Number(byCode['4000'].balance)).toBe(5000); // Sales Revenue
    expect(Number(byCode['2000'].balance)).toBe(100);  // VAT Payable
  });

  it('BNPL sale posts to AR; receivable payment debits Cash, credits AR', async () => {
    const t = await token('je-bnpl@e2e.test');
    await request(http).post('/api/credit/profiles').set(bearer(t)).send({
      customerPhone: '+255700JE001', customerName: 'BNPL Cust', creditLimit: 100000,
    });
    const product = await request(http).post('/api/pos/products').set(bearer(t))
      .send({ sku: 'JE-BNPL', name: 'TV', price: 50000, stock: 5 });

    const sale = await request(http).post('/api/pos/orders').set(bearer(t)).send({
      orderNumber: 'SO-JE-BNPL',
      lines: [{ productId: product.body.id, quantity: 1 }],
      customerPhone: '+255700JE001',
      paymentMethod: 'BNPL',
    });
    expect(sale.status).toBe(201);

    let journal = await request(http).get('/api/erp/journal').set(bearer(t));
    // DR AR (1100) 50000, CR Revenue (4000) 50000  (no tax, no discount)
    const sortedSale = [...journal.body].sort((a, b) => Number(b.debit) - Number(a.debit));
    expect(sortedSale[0].account).toMatch(/^1100/);
    expect(Number(sortedSale[0].debit)).toBe(50000);
    expect(sortedSale[1].account).toMatch(/^4000/);
    expect(Number(sortedSale[1].credit)).toBe(50000);

    // Pay 20000 → DR Cash 20000, CR AR 20000.
    const recId = sale.body.receivable.id as string;
    await request(http).patch(`/api/credit/receivables/${recId}/pay`).set(bearer(t))
      .send({ amount: 20000, reference: 'M-Pesa-XYZ' });

    journal = await request(http).get('/api/erp/journal').set(bearer(t));
    expect(journal.body).toHaveLength(4);
    const accounts = await request(http).get('/api/erp/accounts').set(bearer(t));
    const byCode = Object.fromEntries(accounts.body.map((a: { code: string }) => [a.code, a]));
    expect(Number(byCode['1000'].balance)).toBe(20000); // Cash received
    expect(Number(byCode['1100'].balance)).toBe(30000); // AR remaining
    expect(Number(byCode['4000'].balance)).toBe(50000); // Revenue unchanged
  });

  it('KobePay: customer + deposit + payout + allocation end-to-end', async () => {
    const t = await token('kobepay@e2e.test');

    // Customer create.
    const cust = await request(http).post('/api/kobepay/customers').set(bearer(t))
      .send({ name: 'Juma Abdallah', phone: '+255713456789', company: 'Juma Traders' });
    expect(cust.status).toBe(201);
    expect(cust.body.balance).toBe('0.0000');

    // Phone lookup.
    const lookup = await request(http).get('/api/kobepay/customers/by-phone/+255713456789').set(bearer(t));
    expect(lookup.body.id).toBe(cust.body.id);

    // Supplier create.
    const sup = await request(http).post('/api/kobepay/suppliers').set(bearer(t))
      .send({ name: 'Yiwu Market', country: 'China', contact: 'Wang Fang' });
    expect(sup.status).toBe(201);

    // Confirmed deposit bumps customer balance.
    const dep = await request(http).post('/api/kobepay/deposits').set(bearer(t))
      .send({ customerId: cust.body.id, amount: 1200, method: 'M-Pesa', reference: 'REF1', status: 'Confirmed' });
    expect(dep.status).toBe(201);
    expect(dep.body.status).toBe('Confirmed');
    const after = await request(http).get(`/api/kobepay/customers/by-phone/+255713456789`).set(bearer(t));
    expect(Number(after.body.balance)).toBe(1200);

    // Allocation deducts customer balance.
    const alloc = await request(http).post('/api/kobepay/allocations').set(bearer(t))
      .send({ customerId: cust.body.id, supplierId: sup.body.id, amount: 500, orderRef: 'ORD-1' });
    expect(alloc.status).toBe(201);
    const afterAlloc = await request(http).get(`/api/kobepay/customers/by-phone/+255713456789`).set(bearer(t));
    expect(Number(afterAlloc.body.balance)).toBe(700);

    // Insufficient-balance allocation is rejected.
    const denied = await request(http).post('/api/kobepay/allocations').set(bearer(t))
      .send({ customerId: cust.body.id, supplierId: sup.body.id, amount: 10000, orderRef: 'ORD-X' });
    expect(denied.status).toBe(400);
    expect(denied.body.message).toMatch(/Insufficient/);

    // Payout lifecycle: INITIATED -> SENT -> CONFIRMED -> PAID.
    const payout = await request(http).post('/api/kobepay/payouts').set(bearer(t))
      .send({ supplierId: sup.body.id, amount: 5000, currency: 'CNY', method: 'Bank', initiatedBy: 'Cashier TZ' });
    expect(payout.body.status).toBe('INITIATED');

    const sent = await request(http).patch(`/api/kobepay/payouts/${payout.body.id}/status`).set(bearer(t))
      .send({ status: 'SENT' });
    expect(sent.body.status).toBe('SENT');

    const confirmed = await request(http).patch(`/api/kobepay/payouts/${payout.body.id}/status`).set(bearer(t))
      .send({ status: 'CONFIRMED', confirmedBy: 'Cashier China' });
    expect(confirmed.body.confirmedBy).toBe('Cashier China');

    const paid = await request(http).patch(`/api/kobepay/payouts/${payout.body.id}/status`).set(bearer(t))
      .send({ status: 'PAID' });
    expect(paid.body.status).toBe('PAID');

    // PAID is terminal; can't re-transition.
    const bad = await request(http).patch(`/api/kobepay/payouts/${payout.body.id}/status`).set(bearer(t))
      .send({ status: 'SENT' });
    expect(bad.status).toBe(400);

    // Supplier balance + order count incremented on PAID.
    const sups = await request(http).get('/api/kobepay/suppliers').set(bearer(t));
    expect(Number(sups.body[0].balance)).toBe(5000);
    expect(sups.body[0].orders).toBe(1);
  });

  it('KobePay owner dashboard: projected → realized profit on PAID', async () => {
    const t = await token('profit@e2e.test');

    const cust = await request(http).post('/api/kobepay/customers').set(bearer(t))
      .send({ name: 'Juma Abdallah', phone: '+255713456789' });
    const sup = await request(http).post('/api/kobepay/suppliers').set(bearer(t))
      .send({ name: 'kuku' });

    // Customer deposits 2,000,000 TZS for 5,000 CNY at sales rate 400.
    const dep = await request(http).post('/api/kobepay/deposits').set(bearer(t)).send({
      customerId: cust.body.id,
      amount: 2_000_000, currency: 'TZS',
      method: 'M-Pesa', status: 'Confirmed',
      targetCurrency: 'CNY', targetAmount: 5000, salesRate: 400,
      serviceFee: 0,
    });
    expect(dep.status).toBe(201);
    expect(Number(dep.body.collectedTzs)).toBe(2_000_000);

    // Initiate the payout, link it to the deposit.
    const pay = await request(http).post('/api/kobepay/payouts').set(bearer(t)).send({
      supplierId: sup.body.id, amount: 5000, currency: 'CNY', method: 'Bank',
      depositId: dep.body.id, initiatedBy: 'Cashier TZ',
    });
    expect(pay.body.status).toBe('INITIATED');

    // Before PAID: dashboard shows "Projected" for this transaction.
    let dash = await request(http).get('/api/kobepay/owner-dashboard').set(bearer(t));
    expect(dash.status).toBe(200);
    expect(dash.body.kpis.totalCollected).toBe(2_000_000);
    expect(dash.body.kpis.realizedProfit).toBe(0);
    expect(dash.body.kpis.projectedProfit).toBe(2_000_000);
    expect(dash.body.entries[0].status).toBe('Projected');
    expect(dash.body.entries[0].profitTzs).toBe(0);

    // Walk through SENT → CONFIRMED → PAID with actual cost rate 380.
    await request(http).patch(`/api/kobepay/payouts/${pay.body.id}/status`).set(bearer(t))
      .send({ status: 'SENT' });
    await request(http).patch(`/api/kobepay/payouts/${pay.body.id}/status`).set(bearer(t))
      .send({ status: 'CONFIRMED', confirmedBy: 'Cashier China' });
    await request(http).patch(`/api/kobepay/payouts/${pay.body.id}/status`).set(bearer(t))
      .send({ status: 'PAID', actualRate: 380, bankCharges: 5000 });

    dash = await request(http).get('/api/kobepay/owner-dashboard').set(bearer(t));
    // collected 2M, actual cost = 5000 × 380 = 1.9M, fees = 5000 → profit = 95,000.
    expect(dash.body.kpis.totalCollected).toBe(2_000_000);
    expect(dash.body.kpis.totalPaidToSuppliers).toBe(1_900_000);
    expect(dash.body.kpis.realizedProfit).toBe(95_000);
    expect(dash.body.kpis.bankAndMobileCharges).toBe(5_000);
    // Exchange profit = (400 − 380) × 5000 = 100,000.
    expect(dash.body.kpis.exchangeProfit).toBe(100_000);
    expect(dash.body.entries[0].status).toBe('Realized');
    expect(dash.body.entries[0].profitTzs).toBe(95_000);
  });

  it('rejects unauthenticated access to owned resources', async () => {
    expect((await request(http).get('/api/print/jobs')).status).toBe(401);
    expect((await request(http).get('/api/erp/summary')).status).toBe(401);
  });

  it('validates input (negative qty rejected)', async () => {
    const t = await token('validate@e2e.test');
    const bad = await request(http).post('/api/print/jobs').set(bearer(t)).send({ product: 'X', qty: -5 });
    expect(bad.status).toBe(400);
  });
});
