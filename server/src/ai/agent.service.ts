import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { AiService } from './ai.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge, Tenant, PropertyUnit } from '../property/property.entity';
import { HotelRoom, HotelGuest, HotelBooking } from '../hotel/hotel.entity';
import { HotelFinancialRecord } from '../hotel/hotel-financials.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { ShopExpense, ExpenseCategory } from '../eod/eod.entity';
import { Parcel } from '../cargo/cargo.entity';
import { Shop } from '../shops/shop.entity';
import { AppState } from '../app-state/app-state.entity';
import { SearchDoc } from '../search/search.entity';
import { cosine, tokenize, keywordScore, rankByDesc } from '../search/search.service';
import { AiMemory } from './ai-memory.entity';
import { BeemService } from '../notifications/beem.service';


export interface AgentReply {
  reply: string;
  used?: string;                 // tool that was called (if any)
  specialist?: string;           // which specialist answered (multi-agent team routing)
  data?: unknown;                // raw tool result (for the UI to render tables/print)
  pendingAction?: {              // a write the user must CONFIRM before it runs
    tool: string;
    summary: string;
    args: Record<string, unknown>;
  } | null;
}

type ToolResult = { data: unknown } | { pendingAction: NonNullable<AgentReply['pendingAction']> };

export interface BriefingAlert {
  severity: 'info' | 'warning';
  text: string;
  /**
   * Optional one-tap action. Either an assistant tool (run via
   * /ai/assistant/execute) OR a direct endpoint the UI POSTs to (used for
   * actions owned by other modules, avoiding a service cycle).
   */
  action?: { label: string; tool?: string; args?: Record<string, unknown>; endpoint?: string; method?: 'POST' | 'PUT' };
}
export interface Briefing {
  summary: string;
  alerts: BriefingAlert[];
  data: Record<string, unknown>;
}

interface Tool {
  name: string;
  description: string;
  /** true = mutating/outward action → return a pendingAction instead of running. */
  write?: boolean;
  run(ownerId: string, args: Record<string, unknown>): Promise<ToolResult>;
}

@Injectable()
export class KobeAgentService {
  private readonly logger = new Logger(KobeAgentService.name);

  constructor(
    private readonly ai: AiService,
    @InjectRepository(PosOrder) private readonly orders: Repository<PosOrder>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    @InjectRepository(ProductReview) private readonly reviews: Repository<ProductReview>,
    @InjectRepository(RentCharge) private readonly charges: Repository<RentCharge>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(PropertyUnit) private readonly units: Repository<PropertyUnit>,
    @InjectRepository(HotelRoom) private readonly hotelRooms: Repository<HotelRoom>,
    @InjectRepository(HotelGuest) private readonly hotelGuests: Repository<HotelGuest>,
    @InjectRepository(HotelBooking) private readonly hotelBookings: Repository<HotelBooking>,
    @InjectRepository(HotelFinancialRecord) private readonly hotelFin: Repository<HotelFinancialRecord>,
    @InjectRepository(WarehouseItem) private readonly whItems: Repository<WarehouseItem>,
    @InjectRepository(ShopExpense) private readonly expenses: Repository<ShopExpense>,
    @InjectRepository(Parcel) private readonly parcels: Repository<Parcel>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(AppState) private readonly appState: Repository<AppState>,
    @InjectRepository(SearchDoc) private readonly searchDocs: Repository<SearchDoc>,
    @InjectRepository(AiMemory) private readonly memory: Repository<AiMemory>,
    private readonly beem: BeemService,
  ) {}

  /** Durable facts Kobe remembers about this business (empty if none/first run). */
  private async getFacts(ownerId: string): Promise<string[]> {
    try {
      const row = await this.memory.findOne({ where: { ownerId } });
      return Array.isArray(row?.facts) ? row!.facts : [];
    } catch { return []; }
  }

  /** Save a durable fact/preference for this owner. Deduped, newest kept, capped. */
  private async remember(ownerId: string, fact: string): Promise<string[]> {
    const clean = (fact || '').trim().slice(0, 240);
    if (!clean) return this.getFacts(ownerId);
    let row = await this.memory.findOne({ where: { ownerId } });
    if (!row) row = this.memory.create({ ownerId, facts: [] });
    const existing = (row.facts || []).filter((f) => f.toLowerCase() !== clean.toLowerCase());
    row.facts = [...existing, clean].slice(-30); // keep the 30 most-recent facts
    await this.memory.save(row);
    return row.facts;
  }

  /**
   * Run a CONFIRMED write action (the UI called this after the user approved
   * the pendingAction). Owner-scoped; returns a plain result for the chat.
   */
  async execute(ownerId: string, action: { tool: string; args: Record<string, unknown> }): Promise<{ ok: boolean; message: string }> {
    if (action.tool === 'set_rent') {
      const amount = Number(action.args.amount || 0);
      if (amount <= 0) return { ok: false, message: 'Rent amount must be greater than 0.' };
      let unitId = (action.args.unitId as string) || '';
      if (!unitId && action.args.tenantId) {
        const t = await this.tenants.findOne({ where: { ownerId, id: action.args.tenantId as string } });
        unitId = t?.unitId ?? '';
      }
      if (!unitId) return { ok: false, message: 'Specify which unit to change the rent for.' };
      const res = await this.units.update({ ownerId, id: unitId }, { rentAmount: amount });
      if (!res.affected) return { ok: false, message: 'Unit not found for this owner.' };
      return { ok: true, message: `Rent updated to TZS ${amount.toLocaleString()}.` };
    }

    if (action.tool === 'send_tenant_notification') {
      const message = String(action.args.message || '').trim();
      if (!message) return { ok: false, message: 'Message is empty.' };
      const audience = String(action.args.audience || 'all');
      let phones: string[];
      if (audience === 'unpaid') {
        const rows = await this.charges.find({ where: { ownerId, status: In(['open', 'partial', 'overdue']) }, take: 5000 });
        const ids = [...new Set(rows.filter((c) => Number(c.amount) - Number(c.amountPaid) > 0).map((c) => c.tenantId))];
        const tens = ids.length ? await this.tenants.find({ where: { id: In(ids) } }) : [];
        phones = tens.map((t) => t.phone).filter(Boolean);
      } else {
        const tens = await this.tenants.find({ where: { ownerId }, take: 5000 });
        phones = tens.map((t) => t.phone).filter(Boolean);
      }
      if (!phones.length) return { ok: false, message: 'No tenant phone numbers on file.' };
      const res = await this.beem.sendSmsBatch(phones.map((phone) => ({ phone })), message);
      return res.ok
        ? { ok: true, message: `Sent to ${phones.length} tenant(s).` }
        : { ok: false, message: res.error || 'SMS gateway not configured — set Beem credentials to send.' };
    }

    if (action.tool === 'record_expense') {
      const amount = Number(action.args.amount || 0);
      if (amount <= 0) return { ok: false, message: 'Expense amount must be greater than 0.' };
      const shop = await this.shops.findOne({ where: { ownerId, isDefault: true } })
        ?? await this.shops.findOne({ where: { ownerId } });
      if (!shop) return { ok: false, message: 'No shop found to record the expense against.' };
      await this.expenses.save(this.expenses.create({
        ownerId,
        shopId: shop.id,
        amount,
        category: String(action.args.category || 'other') as ExpenseCategory,
        description: String(action.args.description || ''),
      }));
      return { ok: true, message: `Recorded TZS ${amount.toLocaleString()} expense.` };
    }

    if (action.tool === 'set_room_status') {
      const roomNumber = String(action.args.roomNumber || '').trim();
      const status = String(action.args.status || '').trim();
      const allowed = ['available', 'occupied', 'reserved', 'maintenance'];
      if (!roomNumber) return { ok: false, message: 'Specify which room number.' };
      if (!allowed.includes(status)) return { ok: false, message: `Status must be one of: ${allowed.join(', ')}.` };
      const res = await this.hotelRooms.update({ ownerId, roomNumber }, { status: status as HotelRoom['status'] });
      if (!res.affected) return { ok: false, message: `Room ${roomNumber} not found.` };
      return { ok: true, message: `Room ${roomNumber} set to ${status}.` };
    }

    if (action.tool === 'adjust_stock') {
      const sku = String(action.args.sku || '').trim();
      const quantity = Number(action.args.quantity ?? -1);
      if (!sku) return { ok: false, message: 'Specify the item SKU.' };
      if (!Number.isFinite(quantity) || quantity < 0) return { ok: false, message: 'Quantity must be 0 or more.' };
      const res = await this.whItems.update({ ownerId, sku }, { quantity });
      if (!res.affected) return { ok: false, message: `No warehouse item with SKU "${sku}".` };
      return { ok: true, message: `Stock of ${sku} set to ${quantity}.` };
    }

    if (action.tool === 'add_tenant') {
      const name = String(action.args.name || '').trim();
      const phone = String(action.args.phone || '').trim();
      if (!name) return { ok: false, message: 'Tenant name is required.' };
      if (!phone) return { ok: false, message: 'Tenant phone number is required.' };
      const unitId = (action.args.unitId as string) || undefined;
      await this.tenants.save(this.tenants.create({ ownerId, name, phone, unitId }));
      return { ok: true, message: `Added tenant ${name}.` };
    }

    if (action.tool === 'add_product') {
      const name = String(action.args.name || '').trim();
      const price = Number(action.args.price || 0);
      if (!name) return { ok: false, message: 'Product name is required.' };
      if (price <= 0) return { ok: false, message: 'Product price must be greater than 0.' };
      const sku = String(action.args.sku || '').trim() || name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
      await this.products.save(this.products.create({
        ownerId,
        name,
        price,
        sku,
        category: String(action.args.category || ''),
        stock: Number(action.args.stock || 0),
      }));
      return { ok: true, message: `Added product ${name}.` };
    }

    if (action.tool === 'create_booking') {
      const roomNumber = String(action.args.roomNumber || '').trim();
      const guestName = String(action.args.guestName || '').trim();
      const checkIn = String(action.args.checkIn || '').trim();
      const checkOut = String(action.args.checkOut || '').trim();
      if (!roomNumber || !guestName) return { ok: false, message: 'Room number and guest name are required.' };
      const inD = new Date(checkIn), outD = new Date(checkOut);
      if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) return { ok: false, message: 'Provide a valid check-in and check-out date (check-out after check-in).' };
      const room = await this.hotelRooms.findOne({ where: { ownerId, roomNumber } });
      if (!room) return { ok: false, message: `Room ${roomNumber} not found.` };
      let guest = await this.hotelGuests.findOne({ where: { ownerId, name: guestName } });
      if (!guest) guest = await this.hotelGuests.save(this.hotelGuests.create({ ownerId, name: guestName, phone: String(action.args.guestPhone || '') }));
      const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / 86400000));
      const totalAmount = Number(room.rate || 0) * nights;
      await this.hotelBookings.save(this.hotelBookings.create({
        ownerId, roomId: room.id, guestId: guest.id, checkIn: inD, checkOut: outD,
        status: 'CONFIRMED', totalAmount, currency: room.currency || 'TZS', hotelId: room.hotelId ?? null,
      }));
      await this.hotelRooms.update({ ownerId, id: room.id }, { status: 'reserved' });
      return { ok: true, message: `Booked room ${roomNumber} for ${guestName}, ${nights} night(s), TZS ${totalAmount.toLocaleString()}.` };
    }

    if (action.tool === 'record_rent_payment') {
      const amount = Number(action.args.amount || 0);
      if (amount <= 0) return { ok: false, message: 'Payment amount must be greater than 0.' };
      let tenantId = (action.args.tenantId as string) || '';
      if (!tenantId) {
        const name = String(action.args.tenantName || '').trim();
        if (!name) return { ok: false, message: 'Specify which tenant.' };
        const t = await this.tenants.findOne({ where: { ownerId, name } });
        if (!t) return { ok: false, message: `Tenant "${name}" not found.` };
        tenantId = t.id;
      }
      const open = await this.charges.find({ where: { ownerId, tenantId, status: In(['open', 'partial', 'overdue']) }, order: { dueDate: 'ASC' }, take: 100 });
      if (!open.length) return { ok: false, message: 'This tenant has no outstanding charges.' };
      let remaining = amount;
      for (const c of open) {
        if (remaining <= 0) break;
        const bal = Number(c.amount || 0) - Number(c.amountPaid || 0);
        if (bal <= 0) continue;
        const pay = Math.min(remaining, bal);
        const newPaid = Number(c.amountPaid || 0) + pay;
        await this.charges.update({ ownerId, id: c.id }, { amountPaid: newPaid, status: newPaid >= Number(c.amount || 0) ? 'paid' : 'partial' });
        remaining -= pay;
      }
      const applied = amount - remaining;
      return { ok: true, message: `Recorded TZS ${applied.toLocaleString()} against rent.${remaining > 0 ? ` TZS ${remaining.toLocaleString()} left as credit/unapplied.` : ''}` };
    }

    if (action.tool === 'seed_demo_products') {
      const demo: Array<{ sku: string; name: string; category: string; price: number; compareAtPrice?: number; stock: number }> = [
        { sku: 'DEMO-001', name: 'Home Jersey — Red Club 2025/26', category: 'Club Jerseys', price: 65000, compareAtPrice: 85000, stock: 40 },
        { sku: 'DEMO-002', name: 'Away Jersey — Blue Club 2025/26', category: 'Club Jerseys', price: 65000, compareAtPrice: 85000, stock: 35 },
        { sku: 'DEMO-003', name: 'Third Kit — City Club 2025/26', category: 'Club Jerseys', price: 70000, stock: 25 },
        { sku: 'DEMO-004', name: 'Home Jersey — White Club 2025/26', category: 'Club Jerseys', price: 68000, stock: 30 },
        { sku: 'DEMO-005', name: 'National Team Home Kit — Yellow', category: 'National Teams', price: 60000, stock: 50 },
        { sku: 'DEMO-006', name: 'National Team Home Kit — Sky Blue', category: 'National Teams', price: 60000, compareAtPrice: 75000, stock: 45 },
        { sku: 'DEMO-007', name: 'National Team Home Kit — Green', category: 'National Teams', price: 58000, stock: 60 },
        { sku: 'DEMO-008', name: 'Kids Home Jersey — Red Club', category: 'Kids', price: 40000, stock: 30 },
        { sku: 'DEMO-009', name: 'Kids Home Jersey — Blue Club', category: 'Kids', price: 40000, compareAtPrice: 52000, stock: 26 },
        { sku: 'DEMO-010', name: 'Retro Jersey — Classic Red 1998', category: 'Retro', price: 75000, stock: 15 },
        { sku: 'DEMO-011', name: 'Retro Jersey — Classic Blue 2005', category: 'Retro', price: 75000, compareAtPrice: 95000, stock: 12 },
        { sku: 'DEMO-012', name: 'Training Jersey — Black', category: 'Training', price: 45000, stock: 55 },
        { sku: 'DEMO-013', name: 'Training Jersey — Navy', category: 'Training', price: 45000, stock: 48 },
        { sku: 'DEMO-014', name: 'Goalkeeper Jersey — Green', category: 'Club Jerseys', price: 62000, stock: 18 },
        { sku: 'DEMO-015', name: 'Long-Sleeve Home Jersey — Red Club', category: 'Club Jerseys', price: 70000, compareAtPrice: 88000, stock: 20 },
      ];
      let created = 0;
      for (const d of demo) {
        const exists = await this.products.findOne({ where: { ownerId, sku: d.sku } });
        if (exists) continue;
        await this.products.save(this.products.create({ ownerId, currency: 'TZS', unit: 'piece', description: 'Sample product — edit or replace with your own.', ...d }));
        created += 1;
      }
      return { ok: true, message: `Added ${created} sample product(s). Edit or replace them anytime.` };
    }

    if (action.tool === 'configure_automation') {
      const row = await this.appState.findOne({ where: { ownerId, key: 'automation' } });
      const current = (row?.value as Record<string, unknown>) ?? {};
      const next: Record<string, unknown> = { ...current };
      if (action.args.dailyReport !== undefined) next.dailyReport = !!action.args.dailyReport;
      if (action.args.tenantReminders !== undefined) next.tenantReminders = !!action.args.tenantReminders;
      if (action.args.ownerPhone) next.ownerPhone = String(action.args.ownerPhone);
      if (row) { row.value = next; await this.appState.save(row); }
      else await this.appState.save(this.appState.create({ ownerId, key: 'automation', value: next }));
      const on: string[] = [];
      if (next.dailyReport) on.push('daily reports');
      if (next.tenantReminders) on.push('tenant rent reminders');
      return { ok: true, message: on.length ? `Automation on: ${on.join(' and ')}. I'll handle it from here.` : 'Automation settings updated.' };
    }

    return { ok: false, message: `Unknown action "${action.tool}".` };
  }

  /** Run a READ tool by name and return its data (null on error/unknown). */
  private async runRead(name: string, ownerId: string, args: Record<string, unknown> = {}): Promise<any> {
    const t = this.tools.find((x) => x.name === name);
    if (!t) return null;
    try { const r = await t.run(ownerId, args); return 'data' in r ? r.data : null; }
    catch (e) { this.logger.warn(`briefing tool ${name} failed: ${(e as Error).message}`); return null; }
  }

  /**
   * Proactive daily briefing: aggregates the key signals across modules into a
   * short summary + actionable alerts. Deterministic (no LLM), so it works even
   * when Ollama is offline. Only mentions modules that actually have data.
   * GET /api/ai/briefing
   */
  async briefing(ownerId: string): Promise<Briefing> {
    const [sales, low, unpaid, expenses, occ, cargo] = await Promise.all([
      this.runRead('sales_today', ownerId),
      this.runRead('low_stock', ownerId),
      this.runRead('unpaid_tenants', ownerId),
      this.runRead('expenses_summary', ownerId),
      this.runRead('hotel_occupancy', ownerId),
      this.runRead('cargo_status', ownerId),
    ]);

    const s: string[] = [];
    const alerts: BriefingAlert[] = [];

    if (sales) s.push(`Today: ${sales.orders} sale(s), TZS ${Number(sales.total || 0).toLocaleString()}.`);
    if (occ && occ.totalRooms > 0) s.push(`Hotel ${occ.occupancyRate}% full (${occ.occupied}/${occ.totalRooms}).`);
    if (cargo && cargo.total > 0) {
      const inTransit = Number(cargo.byStatus?.IN_TRANSIT || 0);
      if (inTransit > 0) s.push(`${inTransit} parcel(s) in transit.`);
    }
    if (expenses && expenses.total > 0) s.push(`Spent TZS ${Number(expenses.total).toLocaleString()} this month.`);

    if (low && low.count > 0) {
      alerts.push({ severity: 'warning', text: `${low.count} product(s) at or below reorder level — consider restocking.` });
    }
    if (unpaid && unpaid.count > 0) {
      alerts.push({
        severity: 'warning',
        text: `${unpaid.count} tenant(s) owe TZS ${Number(unpaid.totalOutstanding || 0).toLocaleString()} in rent.`,
        action: {
          tool: 'send_tenant_notification',
          label: 'Send rent reminders',
          args: { audience: 'unpaid', message: 'Reminder: your rent is due. Kindly pay at your earliest convenience. Asante.' },
        },
      });
    }
    if (sales && sales.orders === 0) {
      alerts.push({ severity: 'info', text: 'No sales recorded yet today.' });
    }
    // Month-end rent charges drafted by the automation job, awaiting approval.
    try {
      const autoRow = await this.appState.findOne({ where: { ownerId, key: 'automation' } });
      const pending = (autoRow?.value as { pendingCharges?: { period: string; leaseCount: number } })?.pendingCharges;
      if (pending?.period) {
        alerts.push({
          severity: 'info',
          text: `Rent charges for ${pending.period} are ready for ${pending.leaseCount} lease(s) — approve to generate.`,
          action: { label: 'Generate rent charges', endpoint: '/automation/approve-charges', method: 'POST' },
        });
      }
    } catch { /* automation config optional */ }

    const summary = s.length ? s.join(' ') : 'No activity recorded yet today.';
    return { summary, alerts, data: { sales, low, unpaid, expenses, occ, cargo } };
  }

  private tools: Tool[] = [
    {
      name: 'sales_today',
      description: "Today's sales: number of orders and total revenue.",
      run: async (ownerId) => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const rows = await this.orders.find({ where: { ownerId, createdAt: Between(start, end), status: Not('CANCELLED') as unknown as PosOrder['status'] } });
        const total = rows.reduce((s, o) => s + Number(o.total || 0), 0);
        return { data: { orders: rows.length, total, currency: 'TZS', date: start.toISOString().slice(0, 10) } };
      },
    },
    {
      name: 'low_stock',
      description: 'Products at or below a stock threshold (default 5). args: {threshold?}',
      run: async (ownerId, args) => {
        const threshold = Number(args?.threshold) || 5;
        const rows = await this.products.find({ where: { ownerId }, take: 500 });
        const low = rows.filter((p) => Number(p.stock ?? 0) <= threshold)
          .map((p) => ({ name: p.name, stock: Number(p.stock ?? 0) }))
          .sort((a, b) => a.stock - b.stock);
        return { data: { threshold, count: low.length, items: low.slice(0, 50) } };
      },
    },
    {
      name: 'top_rated_products',
      description: 'Best-liked products by customer review rating. args: {limit?}',
      run: async (ownerId, args) => {
        const limit = Math.min(Number(args?.limit) || 5, 20);
        const rows = await this.reviews.find({ where: { ownerId, approved: true }, take: 2000 });
        const byProd = new Map<string, { sum: number; n: number }>();
        for (const r of rows) { const e = byProd.get(r.productId) ?? { sum: 0, n: 0 }; e.sum += r.rating; e.n += 1; byProd.set(r.productId, e); }
        const ids = [...byProd.keys()];
        const prods = ids.length ? await this.products.find({ where: { id: In(ids) } }) : [];
        const nameOf = (id: string) => prods.find((p) => p.id === id)?.name ?? 'Product';
        const ranked = ids.map((id) => ({ name: nameOf(id), avgRating: +(byProd.get(id)!.sum / byProd.get(id)!.n).toFixed(2), reviews: byProd.get(id)!.n }))
          .sort((a, b) => b.avgRating - a.avgRating || b.reviews - a.reviews).slice(0, limit);
        return { data: { count: ranked.length, items: ranked } };
      },
    },
    {
      name: 'unpaid_tenants',
      description: 'Tenants with outstanding rent (open/partial/overdue charges). Also used to print the pending list.',
      run: async (ownerId) => {
        const rows = await this.charges.find({ where: { ownerId, status: In(['open', 'partial', 'overdue']) }, take: 2000 });
        const byTenant = new Map<string, number>();
        for (const c of rows) { const bal = Number(c.amount || 0) - Number(c.amountPaid || 0); if (bal > 0) byTenant.set(c.tenantId, (byTenant.get(c.tenantId) ?? 0) + bal); }
        const ids = [...byTenant.keys()];
        const tens = ids.length ? await this.tenants.find({ where: { id: In(ids) } }) : [];
        const list = ids.map((id) => { const t = tens.find((x) => x.id === id); return { name: t?.name ?? 'Tenant', phone: t?.phone ?? '', balance: Math.round(byTenant.get(id)!) }; })
          .sort((a, b) => b.balance - a.balance);
        const total = list.reduce((s, t) => s + t.balance, 0);
        return { data: { count: list.length, totalOutstanding: total, currency: 'TZS', tenants: list } };
      },
    },
    {
      name: 'rent_projection',
      description: 'Projected monthly rent income = sum of all active charge amounts for the current period.',
      run: async (ownerId) => {
        const rows = await this.charges.find({ where: { ownerId, status: Not('waived') as unknown as RentCharge['status'] }, take: 5000 });
        const monthly = rows.reduce((s, c) => s + Number(c.amount || 0), 0);
        return { data: { monthly: Math.round(monthly), annual: Math.round(monthly * 12), currency: 'TZS' } };
      },
    },
    {
      name: 'sales_forecast',
      description: "Project this month's total sales from the current run-rate (month-to-date extrapolated to month end).",
      run: async (ownerId) => {
        const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
        const now = new Date();
        const rows = await this.orders.find({ where: { ownerId, createdAt: Between(start, now), status: Not('CANCELLED') as unknown as PosOrder['status'] } });
        const monthToDate = rows.reduce((s, o) => s + Number(o.total || 0), 0);
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedMonthEnd = dayOfMonth > 0 ? Math.round((monthToDate / dayOfMonth) * daysInMonth) : 0;
        return { data: { monthToDate: Math.round(monthToDate), dayOfMonth, daysInMonth, dailyAverage: Math.round(monthToDate / Math.max(1, dayOfMonth)), projectedMonthEnd, currency: 'TZS' } };
      },
    },
    {
      name: 'semantic_search',
      description: 'Find products, tenants or reviews by MEANING and/or exact match (e.g. "cheap kids kit", a phone number, a SKU, "customers unhappy with delivery"). Hybrid keyword+semantic. args: {query, kind?: "product"|"tenant"|"review", limit?}. If the result is `weak`, do NOT state matches as fact — hedge and ask the user to confirm.',
      run: async (ownerId, args) => {
        const query = String(args?.query ?? '').trim();
        if (!query) return { data: { count: 0, results: [] } };
        const where: Record<string, unknown> = { ownerId };
        if (args?.kind) where.kind = String(args.kind);
        const docs = await this.searchDocs.find({ where, take: 10000 });
        if (!docs.length) return { data: { count: 0, results: [], note: 'Search index is empty — open Search and reindex (it also rebuilds daily).' } };
        const limit = Math.min(Number(args?.limit) || 8, 20);

        // Keyword scores (always available) + best-effort vector scores, fused
        // with Reciprocal Rank Fusion. Corrective: expose `weak` so the model
        // hedges instead of hallucinating over a poor match.
        const qTokens = tokenize(query);
        const kw = docs.map((d) => keywordScore(qTokens, query, d.text));
        let qv: number[] | null = null;
        try { const v = await this.ai.generateEmbedding(query.slice(0, 2000), process.env.OLLAMA_EMBED_MODEL || this.ai.getActiveModel()); qv = v.length ? v : null; }
        catch { qv = null; }
        const vec = qv ? docs.map((d) => cosine(qv!, d.vector)) : docs.map(() => 0);
        const vecRank = rankByDesc(vec);
        const kwRank = rankByDesc(kw);
        const K = 60;
        const results = docs
          .map((d, i) => {
            const hasVec = !!qv && vec[i] > 0.05;
            const hasKw = kw[i] > 0;
            if (!hasVec && !hasKw) return null;
            const rrf = (hasVec ? 1 / (K + vecRank[i]) : 0) + (hasKw ? 1 / (K + kwRank[i]) : 0);
            return { kind: d.kind, refId: d.refId, text: d.text, score: +rrf.toFixed(6), vec: +vec[i].toFixed(4) };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        const bestVec = results.reduce((m, r) => Math.max(m, r.vec), 0);
        const bestKw = kw.reduce((m, v) => Math.max(m, v), 0);
        const weak = qv ? bestVec < 0.35 : bestKw < 1;
        const note = !qv
          ? 'Semantic model offline — keyword matches only.'
          : weak
            ? 'No strong match — treat these as guesses; ask the user to confirm rather than stating them as fact.'
            : undefined;
        return { data: { count: results.length, results, weak, note } };
      },
    },
    {
      name: 'remember',
      description: 'Save a durable preference or fact about THIS business so you apply it in future chats (e.g. "reply in Swahili", "VAT is 18%", "main supplier is Acme Ltd", "rent is due on the 5th"). Use only for lasting facts the owner tells you to remember — not one-off requests. args: {fact}.',
      run: async (ownerId, args) => {
        const fact = String(args?.fact ?? '').trim();
        if (!fact) return { data: { saved: false, note: 'Nothing to remember.' } };
        const facts = await this.remember(ownerId, fact);
        return { data: { saved: true, fact, remembered: facts.length } };
      },
    },
    // ── Hotel ──────────────────────────────────────────────────────────────
    {
      name: 'hotel_occupancy',
      description: 'Hotel room occupancy: how many rooms are occupied, reserved, available, in maintenance, and the occupancy rate.',
      run: async (ownerId) => {
        const rooms = await this.hotelRooms.find({ where: { ownerId }, take: 5000 });
        const count = (s: string) => rooms.filter((r) => r.status === s).length;
        const occupied = count('occupied');
        const reserved = count('reserved');
        const total = rooms.length;
        const rate = total ? Math.round(((occupied + reserved) / total) * 100) : 0;
        return { data: { totalRooms: total, occupied, reserved, available: count('available'), maintenance: count('maintenance'), occupancyRate: rate } };
      },
    },
    {
      name: 'hotel_revenue',
      description: "This month's hotel revenue, expenses and net profit (from hotel financial records).",
      run: async (ownerId) => {
        const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
        const rows = await this.hotelFin.find({ where: { ownerId }, take: 10000 });
        let revenue = 0, expense = 0;
        for (const r of rows) {
          if (new Date(r.recordDate) < start) continue;
          const amt = Number(r.amount || 0);
          if (r.category?.includes('revenue')) revenue += amt;
          else if (r.category?.includes('expense')) expense += amt;
        }
        return { data: { month: start.toISOString().slice(0, 7), revenue: Math.round(revenue), expense: Math.round(expense), net: Math.round(revenue - expense), currency: 'TZS' } };
      },
    },
    // ── Warehouse ──────────────────────────────────────────────────────────
    {
      name: 'warehouse_stock',
      description: 'Warehouse stock: item count, how many are at/below reorder level, total stock value, and the low-stock list.',
      run: async (ownerId) => {
        const rows = await this.whItems.find({ where: { ownerId }, take: 5000 });
        const low = rows.filter((i) => Number(i.quantity ?? 0) <= Number(i.reorderLevel ?? 0))
          .map((i) => ({ sku: i.sku, name: i.name, quantity: Number(i.quantity ?? 0), reorderLevel: Number(i.reorderLevel ?? 0) }))
          .sort((a, b) => a.quantity - b.quantity);
        const stockValue = rows.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unitCost ?? 0), 0);
        return { data: { items: rows.length, lowStock: low.length, stockValue: Math.round(stockValue), currency: 'TZS', low: low.slice(0, 50) } };
      },
    },
    // ── Accounting / expenses ──────────────────────────────────────────────
    {
      name: 'expenses_summary',
      description: "This month's business expenses: total and a breakdown by category.",
      run: async (ownerId) => {
        const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
        const rows = await this.expenses.find({ where: { ownerId, createdAt: MoreThanOrEqual(start) }, take: 10000 });
        const byCategory: Record<string, number> = {};
        let total = 0;
        for (const e of rows) { const amt = Number(e.amount || 0); total += amt; byCategory[e.category] = (byCategory[e.category] || 0) + amt; }
        const breakdown = Object.entries(byCategory).map(([category, amount]) => ({ category, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);
        return { data: { month: start.toISOString().slice(0, 7), total: Math.round(total), count: rows.length, currency: 'TZS', breakdown } };
      },
    },
    // ── Cargo ──────────────────────────────────────────────────────────────
    {
      name: 'cargo_status',
      description: 'Cargo parcels overview: total parcels and how many are in each status (registered, in transit, delivered, etc.).',
      run: async (ownerId) => {
        const rows = await this.parcels.find({ where: { ownerId }, take: 5000 });
        const byStatus: Record<string, number> = {};
        for (const p of rows) byStatus[p.status] = (byStatus[p.status] || 0) + 1;
        return { data: { total: rows.length, byStatus } };
      },
    },
    // ── write / outward actions: NEVER auto-run — return for confirmation ──
    {
      name: 'send_tenant_notification',
      description: 'Send a message to tenants. args: {message, audience?: "all"|"unpaid"}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'send_tenant_notification', summary: `Send "${String(args?.message ?? '').slice(0, 80)}" to ${args?.audience ?? 'all'} tenants`, args: { message: String(args?.message ?? ''), audience: String(args?.audience ?? 'all') } },
      }),
    },
    {
      name: 'set_rent',
      description: 'Change a unit/tenant rent. args: {tenantId?, unitId?, amount}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'set_rent', summary: `Set rent to TZS ${Number(args?.amount || 0).toLocaleString()}`, args: { tenantId: args?.tenantId ?? null, unitId: args?.unitId ?? null, amount: Number(args?.amount || 0) } },
      }),
    },
    {
      name: 'record_expense',
      description: 'Record a business expense. args: {amount, category?, description?}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'record_expense', summary: `Record TZS ${Number(args?.amount || 0).toLocaleString()} expense${args?.category ? ` (${args.category})` : ''}`, args: { amount: Number(args?.amount || 0), category: String(args?.category ?? 'other'), description: String(args?.description ?? '') } },
      }),
    },
    {
      name: 'set_room_status',
      description: 'Change a hotel room status. args: {roomNumber, status: "available"|"occupied"|"reserved"|"maintenance"}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'set_room_status', summary: `Set room ${args?.roomNumber ?? '?'} to ${args?.status ?? '?'}`, args: { roomNumber: String(args?.roomNumber ?? ''), status: String(args?.status ?? '') } },
      }),
    },
    {
      name: 'adjust_stock',
      description: 'Set a warehouse item quantity. args: {sku, quantity}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'adjust_stock', summary: `Set stock of ${args?.sku ?? '?'} to ${Number(args?.quantity ?? 0)}`, args: { sku: String(args?.sku ?? ''), quantity: Number(args?.quantity ?? 0) } },
      }),
    },
    {
      name: 'add_tenant',
      description: 'Add a new tenant. args: {name, phone, unitId?}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'add_tenant', summary: `Add tenant "${String(args?.name ?? '').slice(0, 60)}"`, args: { name: String(args?.name ?? ''), phone: String(args?.phone ?? ''), unitId: args?.unitId ?? null } },
      }),
    },
    {
      name: 'add_product',
      description: 'Add a new product to the catalogue. args: {name, price, category?, stock?, sku?}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'add_product', summary: `Add product "${String(args?.name ?? '').slice(0, 60)}" at TZS ${Number(args?.price || 0).toLocaleString()}`, args: { name: String(args?.name ?? ''), price: Number(args?.price || 0), category: String(args?.category ?? ''), stock: Number(args?.stock || 0), sku: String(args?.sku ?? '') } },
      }),
    },
    {
      name: 'create_booking',
      description: 'Book a hotel room for a guest. args: {roomNumber, guestName, guestPhone?, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD)}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'create_booking', summary: `Book room ${args?.roomNumber ?? '?'} for ${args?.guestName ?? 'guest'} (${args?.checkIn ?? '?'} → ${args?.checkOut ?? '?'})`, args: { roomNumber: String(args?.roomNumber ?? ''), guestName: String(args?.guestName ?? ''), guestPhone: String(args?.guestPhone ?? ''), checkIn: String(args?.checkIn ?? ''), checkOut: String(args?.checkOut ?? '') } },
      }),
    },
    {
      name: 'record_rent_payment',
      description: 'Record a rent payment for a tenant (applied to their oldest open charges). args: {tenantName?, tenantId?, amount}',
      write: true,
      run: async (_ownerId, args) => ({
        pendingAction: { tool: 'record_rent_payment', summary: `Record TZS ${Number(args?.amount || 0).toLocaleString()} rent payment for ${args?.tenantName ?? 'tenant'}`, args: { tenantName: String(args?.tenantName ?? ''), tenantId: args?.tenantId ?? null, amount: Number(args?.amount || 0) } },
      }),
    },
    {
      name: 'seed_demo_products',
      description: 'Add a set of placeholder jersey products so an empty shop has something to show (the owner edits them later). No args.',
      write: true,
      run: async () => ({ pendingAction: { tool: 'seed_demo_products', summary: 'Add ~20 sample jersey products (you can edit them later)', args: {} } }),
    },
    {
      name: 'configure_automation',
      description: 'Turn automatic daily owner reports and/or automatic tenant rent reminders on or off. args: {dailyReport?: boolean, tenantReminders?: boolean, ownerPhone?}',
      write: true,
      run: async (_ownerId, args) => {
        const parts: string[] = [];
        if (args?.dailyReport !== undefined) parts.push(`daily reports ${args.dailyReport ? 'ON' : 'OFF'}`);
        if (args?.tenantReminders !== undefined) parts.push(`tenant rent reminders ${args.tenantReminders ? 'ON' : 'OFF'}`);
        return { pendingAction: { tool: 'configure_automation', summary: `Automation: ${parts.join(', ') || 'update settings'}`, args: { dailyReport: args?.dailyReport, tenantReminders: args?.tenantReminders, ownerPhone: args?.ownerPhone ?? '' } } };
      },
    },
  ];

  private toolList(names?: string[]): string {
    const list = names ? this.tools.filter((t) => names.includes(t.name)) : this.tools;
    return list.map((t) => `- ${t.name}: ${t.description}`).join('\n');
  }

  /**
   * MULTI-AGENT SPECIALIST TEAM.
   *
   * Kobe isn't one generalist — it's a team of domain experts (KobePay,
   * Properties, Hotels, Retail, Cargo, Finance). A lightweight router sends each
   * question to the right specialist, who answers with an expert persona and
   * ONLY that domain's tools. Scoping the tool list keeps the local model
   * focused and accurate (small models degrade when shown 25 unrelated tools).
   * Cross-domain / unclear questions fall through to the generalist (all tools).
   */
  private readonly sharedTools = ['semantic_search', 'remember', 'configure_automation'];

  private readonly specialists: Record<
    'kobepay' | 'properties' | 'hotels' | 'shop' | 'cargo' | 'finance',
    { title: string; persona: string; tools: string[] }
  > = {
    kobepay: {
      title: 'KobePay payments specialist',
      persona: "You are Kobe's KobePay specialist — money in and out: recording payments and receipts, rent collections, and reconciling what customers or tenants still owe. Be precise with amounts and always state the currency (TZS).",
      tools: ['record_rent_payment', 'record_expense', 'expenses_summary', 'sales_today', 'unpaid_tenants'],
    },
    properties: {
      title: 'Kobe Properties specialist',
      persona: "You are Kobe's property-management specialist — tenants, leases, rent, arrears and tenant communication. Think like a landlord's manager: who owes, how much, and what to do next.",
      tools: ['unpaid_tenants', 'rent_projection', 'set_rent', 'add_tenant', 'record_rent_payment', 'send_tenant_notification'],
    },
    hotels: {
      title: 'Kobe Hotels specialist',
      persona: "You are Kobe's hospitality specialist — room occupancy, bookings, housekeeping status and hotel revenue. Think like a front-desk + revenue manager.",
      tools: ['hotel_occupancy', 'hotel_revenue', 'set_room_status', 'create_booking'],
    },
    shop: {
      title: 'Retail & inventory specialist',
      persona: "You are Kobe's retail specialist — POS sales, pricing, stock and the product catalogue. Think like a shopkeeper watching sales and stock.",
      tools: ['sales_today', 'low_stock', 'top_rated_products', 'sales_forecast', 'warehouse_stock', 'adjust_stock', 'add_product', 'seed_demo_products'],
    },
    cargo: {
      title: 'Cargo & logistics specialist',
      persona: "You are Kobe's cargo specialist — parcels, shipments and delivery status.",
      tools: ['cargo_status'],
    },
    finance: {
      title: 'Finance & accounting specialist',
      persona: "You are Kobe's finance specialist — expenses, cash flow, revenue-vs-cost and month-to-date performance across the whole business. Think like an accountant.",
      tools: ['expenses_summary', 'record_expense', 'sales_today', 'sales_forecast', 'rent_projection', 'hotel_revenue'],
    },
  };

  /** Route a question to the specialist whose domain it fits (keyword-first, offline-safe). */
  private classifyDomain(message: string): keyof typeof this.specialists | 'general' {
    const m = ` ${message.toLowerCase()} `;
    const has = (...w: string[]) => w.some((x) => m.includes(x));
    if (has('kobepay', 'receipt', 'payment', 'paid ', ' pay ', 'collect', 'reconcile', 'deposit', 'transaction')) return 'kobepay';
    if (has('room', 'guest', 'booking', 'check-in', 'checkout', 'occupanc', 'hotel', 'housekeep', 'reservation')) return 'hotels';
    if (has('tenant', 'rent', 'lease', 'landlord', 'property', 'properties', 'unit', 'apartment', 'arrear', 'eviction')) return 'properties';
    if (has('parcel', 'cargo', 'shipment', 'delivery', 'courier', 'freight', 'consignment')) return 'cargo';
    if (has('expense', 'profit', 'cash flow', 'cashflow', 'tax', 'margin', 'accounting', 'balance sheet', 'p&l')) return 'finance';
    if (has('sale', 'stock', 'product', 'inventory', 'price', 'sku', 'restock', 'sell', 'catalog', 'warehouse')) return 'shop';
    return 'general';
  }

  /** Extract the first {...} JSON object from a model response, if any. */
  private extractToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const obj = JSON.parse(m[0]);
      if (obj && typeof obj.tool === 'string') return { tool: obj.tool, args: obj.args ?? {} };
    } catch { /* not a tool call */ }
    return null;
  }

  async run(ownerId: string, message: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = []): Promise<AgentReply> {
    const facts = await this.getFacts(ownerId);
    const memoryBlock = facts.length
      ? `\nWhat you remember about this business (apply it, don't restate it unless asked):\n${facts.map((f) => `- ${f}`).join('\n')}\n`
      : '';
    // Route to the specialist whose domain fits, then scope the tool list to
    // that specialist (+ shared tools). Generalist sees everything.
    const domain = this.classifyDomain(message);
    const spec = domain === 'general' ? null : this.specialists[domain];
    const activeToolNames = spec ? [...spec.tools, ...this.sharedTools] : undefined;
    const personaLine = spec ? `${spec.persona}\n` : '';

    const system = `You are Kobe, a concise business assistant inside KobeOS. ${personaLine}Answer questions about the owner's business using ONLY the tools below.
When you need data, reply with EXACTLY one JSON object and nothing else: {"tool":"<name>","args":{...}}.
After you receive the tool result, answer the user in plain language (short, with the key numbers). If no tool is needed, just answer.
${memoryBlock}Tools:
${this.toolList(activeToolNames)}`;

    const first = await this.ai.chatCompletion({
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: message }],
    }).catch((e) => { this.logger.warn(`LLM error: ${(e as Error).message}`); return { content: '' } as { content: string }; });

    const specialist = spec?.title;
    const call = this.extractToolCall(first.content || '');
    if (!call) return { reply: (first.content || '').trim() || "I couldn't reach the local AI model. Is Ollama running?", specialist, pendingAction: null };

    const tool = this.tools.find((t) => t.name === call.tool);
    if (!tool) return { reply: first.content.trim(), specialist, pendingAction: null };

    const result = await tool.run(ownerId, call.args);
    if ('pendingAction' in result) {
      return { reply: `Ready to ${result.pendingAction.summary.toLowerCase()}. Confirm to proceed.`, used: tool.name, specialist, pendingAction: result.pendingAction };
    }

    // Feed the tool result back for a natural-language answer.
    const second = await this.ai.chatCompletion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
        { role: 'assistant', content: JSON.stringify(call) },
        { role: 'user', content: `Tool ${tool.name} returned: ${JSON.stringify(result.data)}. Answer the original question briefly using these numbers.` },
      ],
    }).catch(() => ({ content: '' } as { content: string }));

    const reply = (second.content || '').trim() || this.fallbackSummary(tool.name, result.data);
    return { reply, used: tool.name, specialist, data: result.data, pendingAction: null };
  }

  /** Deterministic answer if the model can't phrase it (or is offline). */
  private fallbackSummary(tool: string, data: any): string {
    switch (tool) {
      case 'sales_today': return `Today: ${data.orders} orders, TZS ${Number(data.total).toLocaleString()}.`;
      case 'low_stock': return `${data.count} product(s) at/below ${data.threshold} in stock.`;
      case 'top_rated_products': return data.items?.length ? `Top: ${data.items.map((i: any) => `${i.name} (${i.avgRating}★)`).join(', ')}.` : 'No reviews yet.';
      case 'unpaid_tenants': return `${data.count} tenant(s) owe TZS ${Number(data.totalOutstanding).toLocaleString()}.`;
      case 'rent_projection': return `Projected rent: TZS ${Number(data.monthly).toLocaleString()}/mo (TZS ${Number(data.annual).toLocaleString()}/yr).`;
      case 'hotel_occupancy': return `${data.occupancyRate}% occupancy — ${data.occupied} occupied, ${data.reserved} reserved, ${data.available} free of ${data.totalRooms} rooms.`;
      case 'hotel_revenue': return `Hotel ${data.month}: revenue TZS ${Number(data.revenue).toLocaleString()}, expenses TZS ${Number(data.expense).toLocaleString()}, net TZS ${Number(data.net).toLocaleString()}.`;
      case 'warehouse_stock': return `${data.items} items, ${data.lowStock} at/below reorder level. Stock value TZS ${Number(data.stockValue).toLocaleString()}.`;
      case 'expenses_summary': return `${data.month} expenses: TZS ${Number(data.total).toLocaleString()} across ${data.count} entries.`;
      case 'cargo_status': return `${data.total} parcel(s): ${Object.entries(data.byStatus || {}).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ') || 'none'}.`;
      case 'sales_forecast': return `Month-to-date TZS ${Number(data.monthToDate).toLocaleString()} (day ${data.dayOfMonth}/${data.daysInMonth}). Projected month-end: TZS ${Number(data.projectedMonthEnd).toLocaleString()}.`;
      case 'semantic_search': return data.count ? `Found ${data.count} match(es): ${data.results.slice(0, 5).map((r: any) => r.text.slice(0, 40)).join('; ')}.` : (data.note || 'No matches found.');
      case 'remember': return data.saved ? `Got it — I'll remember that.` : (data.note || 'Nothing to remember.');
      default: return JSON.stringify(data);
    }
  }
}
