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
import { AiDocsService } from './ai-docs.service';
import { SystemHealthService } from '../system-health/system-health.service';
import { BeemService } from '../notifications/beem.service';
import { AiMemoryNode, AiSkillInstall } from './ai-operating.entity';


export interface AgentActivity {
  stage: 'understanding' | 'retrieving' | 'routing' | 'checking_data' | 'preparing_action' | 'thinking' | 'responding';
  label: string;
  detail?: string;
}

export interface AgentCitation {
  kind: 'tool' | 'document' | 'memory' | 'screen';
  label: string;
  ref?: string;
  detail?: string;
}

export interface AgentRequestContext {
  role?: string;
  appId?: string;
  module?: string;
  screenLabel?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  fields?: Record<string, unknown>;
}

export interface AgentReply {
  reply: string;
  confidence?: number;
  citations?: AgentCitation[];
  needsVerification?: boolean;
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
  private readonly toolCache = new Map<string, { expiresAt: number; result: ToolResult }>();
  private readonly cacheableTools = new Set([
    'sales_today', 'low_stock', 'top_rated_products', 'unpaid_tenants', 'rent_projection',
    'sales_forecast', 'hotel_occupancy', 'hotel_revenue', 'warehouse_stock',
    'expenses_summary', 'cargo_status', 'business_health',
  ]);

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
    @InjectRepository(AiMemoryNode) private readonly memoryNodes: Repository<AiMemoryNode>,
    @InjectRepository(AiSkillInstall) private readonly skillInstalls: Repository<AiSkillInstall>,
    private readonly beem: BeemService,
    private readonly aiDocs: AiDocsService,
    private readonly systemHealth: SystemHealthService,
  ) {}

  /** Durable facts Kobe remembers about this business (empty if none/first run). */
  private async getFacts(ownerId: string): Promise<string[]> {
    try {
      const row = await this.memory.findOne({ where: { ownerId } });
      return Array.isArray(row?.facts) ? row!.facts : [];
    } catch { return []; }
  }

  private async structuredMemory(ownerId: string, message: string) {
    try {
      const rows = await this.memoryNodes.find({ where: { ownerId }, order: { updatedAt: 'DESC' }, take: 300 });
      const terms = new Set(message.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3));
      return rows
        .map((node) => {
          const hay = `${node.label} ${JSON.stringify(node.attributes)}`.toLowerCase();
          const score = [...terms].reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
          return { node, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => item.node);
    } catch {
      return [];
    }
  }

  private readonly packTools: Record<string, string[]> = {
    'core-operator': ['semantic_search', 'search_documents', 'remember', 'diagnose_system', 'configure_automation', 'business_health'],
    accountant: ['sales_today', 'expenses_summary', 'sales_forecast', 'record_expense', 'business_health'],
    'hotel-manager': ['hotel_occupancy', 'hotel_revenue', 'create_booking', 'set_room_status'],
    'property-manager': ['unpaid_tenants', 'rent_projection', 'set_rent', 'add_tenant', 'record_rent_payment', 'send_tenant_notification'],
    'retail-manager': ['sales_today', 'low_stock', 'top_rated_products', 'warehouse_stock', 'adjust_stock', 'add_product'],
    'cargo-manager': ['cargo_status'],
    'sacco-credit': ['semantic_search', 'search_documents'],
    recruitment: ['semantic_search', 'search_documents'],
    'creator-growth': ['semantic_search', 'search_documents'],
    'school-admin': ['semantic_search', 'search_documents'],
  };

  private async installedPackState(ownerId: string) {
    try {
      const rows = await this.skillInstalls.find({ where: { ownerId }, take: 100 });
      if (!rows.length) return { packIds: ['core-operator'], configured: false };
      const enabled = rows.filter((row) => row.enabled).map((row) => row.skillId);
      return { packIds: ['core-operator', ...enabled.filter((id) => id !== 'core-operator')], configured: true };
    } catch {
      return { packIds: ['core-operator'], configured: false };
    }
  }

  private async learnCorrection(ownerId: string, message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) {
    if (!/^(no[,: ]|actually\b|correction\b|that'?s wrong\b)/i.test(message.trim())) return;
    const previous = [...history].reverse().find((entry) => entry.role === 'assistant')?.content || '';
    const key = `correction-${Date.now()}`;
    await this.memoryNodes.save(this.memoryNodes.create({
      ownerId,
      nodeType: 'correction',
      externalKey: key,
      label: message.slice(0, 220),
      attributes: { previousAssistantAnswer: previous.slice(0, 1200), correctedByUser: message.slice(0, 2000) },
      confidence: 1,
      source: 'human-correction',
      lastVerifiedAt: new Date(),
    })).catch(() => undefined);
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
        const tens = ids.length ? await this.tenants.find({ where: { ownerId, id: In(ids) } }) : [];
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
      name: 'business_health',
      description: 'Cross-module business health snapshot combining today sales, current-month expenses, unpaid rent, hotel occupancy, low stock and cargo status. Use for owner overview, business health, "what needs attention", or cross-module reasoning.',
      run: async (ownerId) => {
        const now = new Date();
        const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const [orders, expenses, charges, rooms, stock, parcels] = await Promise.all([
          this.orders.find({ where: { ownerId, createdAt: MoreThanOrEqual(dayStart), status: Not('CANCELLED') as unknown as PosOrder['status'] }, take: 10000 }),
          this.expenses.find({ where: { ownerId, createdAt: MoreThanOrEqual(monthStart) }, take: 10000 }),
          this.charges.find({ where: { ownerId, status: In(['open', 'partial', 'overdue']) }, take: 10000 }),
          this.hotelRooms.find({ where: { ownerId }, take: 5000 }),
          this.whItems.find({ where: { ownerId }, take: 10000 }),
          this.parcels.find({ where: { ownerId }, take: 10000 }),
        ]);
        const sales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const outstandingRent = charges.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0) - Number(row.amountPaid || 0)), 0);
        const occupied = rooms.filter((room) => room.status === 'occupied' || room.status === 'reserved').length;
        const lowStock = stock.filter((item) => item.quantity <= item.reorderLevel).length;
        const parcelByStatus: Record<string, number> = {};
        for (const parcel of parcels) {
          const status = parcel.lifecycleStatus || parcel.status || 'UNKNOWN';
          parcelByStatus[status] = (parcelByStatus[status] || 0) + 1;
        }
        return {
          data: {
            generatedAt: now.toISOString(),
            salesToday: Math.round(sales),
            expensesMonth: Math.round(expenseTotal),
            outstandingRent: Math.round(outstandingRent),
            hotel: { totalRooms: rooms.length, occupiedOrReserved: occupied, occupancyRate: rooms.length ? Math.round((occupied / rooms.length) * 100) : 0 },
            inventory: { items: stock.length, lowStock },
            cargo: { total: parcels.length, byStatus: parcelByStatus },
            currency: 'TZS',
          },
        };
      },
    },
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
        const prods = ids.length ? await this.products.find({ where: { ownerId, id: In(ids) } }) : [];
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
        const tens = ids.length ? await this.tenants.find({ where: { ownerId, id: In(ids) } }) : [];
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
        try { const v = await this.ai.generateEmbedding(query.slice(0, 2000), process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'); qv = v.length ? v : null; }
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
    {
      name: 'search_documents',
      description: 'Answer from the owner\'s UPLOADED documents (contracts, price lists, supplier catalogues, policies). Use this whenever the question is about "the contract", "the price list", "our policy", or any document they uploaded. args: {query, documentId?}. Ground your answer ONLY in the returned passages; if `weak` is true, say you could not find it rather than guessing.',
      run: async (ownerId, args) => {
        const query = String(args?.query ?? '').trim();
        if (!query) return { data: { count: 0, passages: [] } };
        const documentId = args?.documentId ? String(args.documentId) : undefined;
        const { passages, weak, note } = await this.aiDocs.search(ownerId, query, 6, documentId);
        return { data: { count: passages.length, passages, weak, note } };
      },
    },
    {
      name: 'diagnose_system',
      description: 'Check whether KobeOS itself is healthy and explain any problem in plain language with the likely fix. Use this when the user says something is "not working", "broken", "slow", "offline", or asks if the system is OK. args: {} (no arguments).',
      run: async () => {
        const report = this.systemHealth.getReport();
        const health = await this.ai.health().catch(() => null as unknown as { running?: boolean; models?: unknown[] });
        const advice: string[] = [];
        if (report.subsystems.database.state === 'down') {
          advice.push('The database is down — this is the critical one. It is retrying automatically; if it does not recover, restart KobeOS. Your data is safe.');
        }
        if (report.subsystems.ai.state === 'down' || !health?.running) {
          advice.push('The local AI (Ollama) is offline, so Kobe is in offline mode — keyword search and deterministic reports still work. Start Ollama (or the KobeOS AI runtime) to restore smart answers.');
        } else if (Array.isArray(health?.models) && health.models.length === 0) {
          advice.push('The AI is running but no model is installed. Install a recommended chat model in Kobe Models.');
        }
        if (!advice.length) advice.push('Everything looks healthy — database and local AI are both up.');
        return { data: { mode: report.mode, message: report.message, subsystems: report.subsystems, advice } };
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
  private readonly sharedTools = ['semantic_search', 'search_documents', 'diagnose_system', 'remember', 'configure_automation'];

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

  listSkills() {
    return this.tools.map(({ name, description, write = false }) => {
      const domains = Object.entries(this.specialists)
        .filter(([, spec]) => spec.tools.includes(name))
        .map(([domain]) => domain);
      if (this.sharedTools.includes(name)) domains.push('shared');
      return {
        name,
        description,
        write,
        kind: write ? 'action' : 'read',
        domains: [...new Set(domains.length ? domains : ['general'])],
      };
    });
  }


  /**
   * Run a verified read-only Kobe skill directly, without invoking an LLM.
   * Operating dashboards, simulations and health checks use this path so they
   * remain deterministic even if Ollama is offline or cooling down.
   */
  async runReadSkill(ownerId: string, name: string, args: Record<string, unknown> = {}): Promise<AgentReply> {
    const tool = this.tools.find((candidate) => candidate.name === name);
    if (!tool) {
      return { reply: `Unknown Kobe skill: ${name}`, confidence: 0, citations: [], needsVerification: true, pendingAction: null };
    }
    if (tool.write) {
      return { reply: `Skill ${name} is an action and cannot run through the read-only path.`, confidence: 0, citations: [], needsVerification: true, pendingAction: null };
    }
    const result = await this.runToolCached(ownerId, tool, args);
    if ('pendingAction' in result) {
      return { reply: 'This skill unexpectedly requested an action.', confidence: 0, citations: [], needsVerification: true, pendingAction: null };
    }
    const summary = this.directToolSummary(name, result.data) ?? this.fallbackSummary(name, result.data);
    const data = result.data as { weak?: boolean } | null;
    return {
      reply: summary,
      used: name,
      data: result.data,
      confidence: data && typeof data === 'object' && data.weak ? 0.55 : 0.99,
      citations: [{ kind: 'tool', label: name.replace(/_/g, ' '), ref: name }],
      needsVerification: Boolean(data && typeof data === 'object' && data.weak),
      pendingAction: null,
    };
  }

  async knowledgeStatus(ownerId: string) {
    const [documents, facts, indexedRecords] = await Promise.all([
      this.aiDocs.list(ownerId).catch(() => []),
      this.getFacts(ownerId),
      this.searchDocs.count({ where: { ownerId } }).catch(() => 0),
    ]);
    return {
      skills: this.listSkills().length,
      documents: documents.length,
      documentPassages: documents.reduce((sum, doc) => sum + Number(doc.chunkCount || 0), 0),
      indexedBusinessRecords: indexedRecords,
      rememberedFacts: facts.length,
      sources: [
        { id: 'live-database', label: 'Live KobeOS business database', ready: true },
        { id: 'business-index', label: 'Semantic business search index', ready: indexedRecords > 0, count: indexedRecords },
        { id: 'documents', label: 'Uploaded business documents', ready: documents.length > 0, count: documents.length },
        { id: 'memory', label: 'Remembered owner facts and preferences', ready: facts.length > 0, count: facts.length },
      ],
    };
  }

  private async retrieveKnowledge(ownerId: string, message: string) {
    try {
      const found = await this.aiDocs.search(ownerId, message, 4);
      if (found.weak || !found.passages.length) return [];
      return found.passages.map((p) => ({
        title: p.title,
        documentId: p.documentId,
        text: p.text.slice(0, 1400),
        score: p.score,
      }));
    } catch {
      return [];
    }
  }

  private selectRelevantHistory(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    mode: 'fast' | 'quality',
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const max = mode === 'fast' ? 6 : 14;
    if (history.length <= max) return history;
    const terms = new Set(
      message.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 4).slice(0, 24),
    );
    const recent = history.slice(-6);
    const older = history.slice(0, -6)
      .map((entry, index) => ({
        entry,
        index,
        score: entry.content.toLowerCase().split(/[^a-z0-9]+/)
          .reduce((score, term) => score + (terms.has(term) ? 1 : 0), 0),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.index - a.index)
      .slice(0, Math.max(0, max - recent.length))
      .sort((a, b) => a.index - b.index)
      .map((item) => item.entry);
    return [...older, ...recent].slice(-max);
  }

  private async runToolCached(ownerId: string, tool: Tool, args: Record<string, unknown>): Promise<ToolResult> {
    if (!this.cacheableTools.has(tool.name) || tool.write) return tool.run(ownerId, args);
    const key = `${ownerId}:${tool.name}:${JSON.stringify(args)}`;
    const hit = this.toolCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.result;
    const result = await tool.run(ownerId, args);
    this.toolCache.set(key, { expiresAt: Date.now() + 20_000, result });
    if (this.toolCache.size > 500) {
      for (const [cacheKey, value] of this.toolCache) {
        if (value.expiresAt <= Date.now()) this.toolCache.delete(cacheKey);
        if (this.toolCache.size <= 400) break;
      }
    }
    return result;
  }

  private directToolSummary(tool: string, data: unknown): string | null {
    const deterministic = new Set([
      'sales_today', 'low_stock', 'top_rated_products', 'unpaid_tenants', 'rent_projection',
      'sales_forecast', 'hotel_occupancy', 'hotel_revenue', 'warehouse_stock',
      'expenses_summary', 'cargo_status', 'business_health', 'diagnose_system', 'remember',
    ]);
    return deterministic.has(tool) ? this.fallbackSummary(tool, data as any) : null;
  }

  /**
   * Handle obvious questions and business intents without depending on the
   * language model. This keeps Kobe useful while Ollama is starting or absent,
   * and lets the model focus on genuinely open-ended requests.
   */
  private async deterministicReply(ownerId: string, message: string): Promise<AgentReply | null> {
    const q = message.trim().toLowerCase();
    if (!q) return null;

    if (/^(hi|hello|hey|habari|mambo|good (morning|afternoon|evening))[!. ]*$/.test(q)) {
      return {
        reply: 'Hello! I’m Kobe. I can answer general questions and work with sales, property, hotel, warehouse, cargo, expenses, products, and automations.',
        pendingAction: null,
      };
    }
    if (/\b(who are you|what are you)\b/.test(q)) {
      return {
        reply: 'I’m Kobe, the KobeOS business assistant. I can answer questions, read your live business data, and prepare actions for you to confirm.',
        pendingAction: null,
      };
    }
    if (/\b(what can you do|show (me )?(your )?skills|list (your )?skills|help me)\b/.test(q)) {
      const readable = this.listSkills().filter((skill) => !skill.write).length;
      const actions = this.listSkills().filter((skill) => skill.write).length;
      return {
        reply: `I have ${readable} reporting skills and ${actions} action skills. I can check sales, stock, rent, hotel occupancy, expenses, cargo and forecasts, then prepare actions such as recording rent, adding tenants/products, booking rooms and updating stock.`,
        data: { skills: this.listSkills() },
        pendingAction: null,
      };
    }
    if (/\b(what time is it|current time)\b/.test(q)) {
      return { reply: `It is ${new Date().toLocaleTimeString()}.`, pendingAction: null };
    }
    if (/\b(what(?:'s| is) (today'?s )?date|current date|what day is it)\b/.test(q)) {
      return {
        reply: `Today is ${new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
        pendingAction: null,
      };
    }

    const arithmetic = q.match(/(?:what is|calculate)\s+(-?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*(-?\d+(?:\.\d+)?)/);
    if (arithmetic) {
      const left = Number(arithmetic[1]);
      const right = Number(arithmetic[3]);
      const operator = arithmetic[2];
      const result =
        operator === '+' ? left + right :
          operator === '-' ? left - right :
            operator === '*' || operator === 'x' || operator === '×' ? left * right :
              right === 0 ? NaN : left / right;
      return {
        reply: Number.isFinite(result) ? `${left} ${operator} ${right} = ${result}` : 'That calculation is undefined.',
        pendingAction: null,
      };
    }

    if (/\brecord\b.*\brent payment\b/.test(q)) {
      const numberMatch = message.replace(/,/g, '').match(/\b(\d+(?:\.\d+)?)\s*(k|m)?\b/i);
      const amount = numberMatch
        ? Number(numberMatch[1]) * (numberMatch[2]?.toLowerCase() === 'm' ? 1_000_000 : numberMatch[2]?.toLowerCase() === 'k' ? 1_000 : 1)
        : 0;
      const tenantMatch = message.match(/\b(?:for|from)\s+(.+?)(?:\s+(?:tzs|amount|of)\b|$)/i);
      const tenantName = tenantMatch?.[1]?.trim() ?? '';
      if (!amount || !tenantName) {
        return {
          reply: 'Tell me the tenant and amount, for example: “Record a rent payment of TZS 250,000 for Asha M.”',
          pendingAction: null,
        };
      }
      const tool = this.tools.find((item) => item.name === 'record_rent_payment')!;
      const result = await tool.run(ownerId, { tenantName, amount });
      return 'pendingAction' in result
        ? { reply: `Ready to ${result.pendingAction.summary.toLowerCase()}. Confirm to proceed.`, used: tool.name, pendingAction: result.pendingAction }
        : null;
    }

    const intents: Array<{ pattern: RegExp; tool: string }> = [
      { pattern: /\b(today'?s sales|sales today|revenue today)\b/, tool: 'sales_today' },
      { pattern: /\b(low stock|out of stock|restock)\b/, tool: 'low_stock' },
      { pattern: /\b(top rated|best liked|customer favorites|customer favourites)\b/, tool: 'top_rated_products' },
      { pattern: /\b(unpaid tenants|tenants.*(?:owe|haven'?t paid|not paid)|outstanding rent)\b/, tool: 'unpaid_tenants' },
      { pattern: /\b(rent projection|projected rent|monthly rent income)\b/, tool: 'rent_projection' },
      { pattern: /\b(sales forecast|project.*sales|month.?end sales)\b/, tool: 'sales_forecast' },
      { pattern: /\b(hotel occupancy|rooms? (?:occupied|available|reserved)|how full.*hotel)\b/, tool: 'hotel_occupancy' },
      { pattern: /\b(hotel revenue|hotel profit|hotel income)\b/, tool: 'hotel_revenue' },
      { pattern: /\b(warehouse stock|stock value|warehouse value)\b/, tool: 'warehouse_stock' },
      { pattern: /\b(expenses|spent this month|monthly spending)\b/, tool: 'expenses_summary' },
      { pattern: /\b(cargo status|parcel status|parcels?.*(?:transit|delivered|registered))\b/, tool: 'cargo_status' },
      { pattern: /\b(business health|overall business|what needs attention|business overview|how is my business)\b/, tool: 'business_health' },
    ];

    const intent = intents.find((item) => item.pattern.test(q));
    if (!intent) return null;
    const tool = this.tools.find((item) => item.name === intent.tool);
    if (!tool) return null;
    try {
      const result = await this.runToolCached(ownerId, tool, {});
      if ('pendingAction' in result) {
        return {
          reply: `Ready to ${result.pendingAction.summary.toLowerCase()}. Confirm to proceed.`,
          used: tool.name,
          pendingAction: result.pendingAction,
        };
      }
      return {
        reply: this.fallbackSummary(tool.name, result.data),
        used: tool.name,
        data: result.data,
        pendingAction: null,
      };
    } catch (error) {
      this.logger.warn(`Deterministic skill ${tool.name} failed: ${(error as Error).message}`);
      return null;
    }
  }

  async run(
    ownerId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    mode: 'fast' | 'quality' = 'quality',
    onToken?: (token: string) => void,
    onActivity?: (activity: AgentActivity) => void,
    requestContext: AgentRequestContext = {},
  ): Promise<AgentReply> {
    const activity = (stage: AgentActivity['stage'], label: string, detail?: string) =>
      onActivity?.({ stage, label, detail });

    activity('understanding', 'Understanding your request…');
    await this.learnCorrection(ownerId, message, history);
    const deterministic = await this.deterministicReply(ownerId, message);
    if (deterministic) {
      activity('responding', 'Preparing verified answer…');
      if (onToken && deterministic.reply) onToken(deterministic.reply);
      return {
        ...deterministic,
        confidence: deterministic.used ? 0.99 : 0.9,
        citations: deterministic.used ? [{ kind: 'tool', label: deterministic.used.replace(/_/g, ' '), ref: deterministic.used }] : [],
        needsVerification: false,
      };
    }

    activity('retrieving', 'Searching memory and business knowledge…');
    const relevantHistory = this.selectRelevantHistory(message, history, mode);
    const [facts, knowledge, graphMemory, packState, plan] = await Promise.all([
      this.getFacts(ownerId),
      mode === 'quality' ? this.retrieveKnowledge(ownerId, message) : Promise.resolve([]),
      this.structuredMemory(ownerId, message),
      this.installedPackState(ownerId),
      this.ai.planAssistant(
        message,
        this.tools.map(({ name, description }) => ({ name, description })),
      ),
    ]);
    const memoryBlock = facts.length
      ? `\nUseful durable memory about this business:\n${facts.map((f) => `- ${f}`).join('\n')}\n`
      : '';
    const knowledgeBlock = knowledge.length
      ? `\nRetrieved owner knowledge (use only when relevant):\n${knowledge.map((p) => `[${p.title}] ${p.text}`).join('\n')}\n`
      : '';
    const graphBlock = graphMemory.length
      ? `\nStructured company memory:\n${graphMemory.map((node) => `- ${node.nodeType}: ${node.label} ${JSON.stringify(node.attributes)}`).join('\n')}\n`
      : '';
    const screenBlock = requestContext.screenLabel || requestContext.entityLabel
      ? `\nLive screen context: module=${requestContext.module || requestContext.appId || 'unknown'}; screen=${requestContext.screenLabel || ''}; selected=${requestContext.entityType || ''} ${requestContext.entityLabel || ''} ${requestContext.entityId || ''}; fields=${JSON.stringify(requestContext.fields || {})}. Treat this as navigation context, not independent proof of financial facts.\n`
      : '';
    const packBlock = packState.packIds.length ? `\nInstalled Kobe skill packs: ${packState.packIds.join(', ')}.\n` : '';
    activity('routing', plan.domain === 'general' ? 'Choosing the best AI skill…' : `Routing to ${plan.domain} specialist…`);

    const spec = plan.domain === 'general' ? null : this.specialists[plan.domain];
    const specialist = spec?.title;
    const persona = spec?.persona ?? 'You are Kobe, the cross-business operating assistant inside KobeOS.';
    const allowedNames = spec ? new Set([...spec.tools, ...this.sharedTools]) : new Set(this.tools.map((tool) => tool.name));
    const restrictedRole = ['government_viewer', 'settlement_officer', 'compliance_officer', 'traffic_enforcement'].includes(requestContext.role || '');
    const packAllowed = new Set(packState.packIds.flatMap((id) => this.packTools[id] || []));
    const plannedCalls = plan.toolCalls
      .filter((call) => allowedNames.has(call.tool))
      .filter((call) => !packState.configured || packAllowed.has(call.tool) || this.sharedTools.includes(call.tool))
      .filter((call) => !restrictedRole || !this.tools.find((tool) => tool.name === call.tool)?.write)
      .slice(0, 4);

    const baseSystem = `${persona}
Answer in the user's language. Be concise but useful. Use remembered business facts when relevant. Never claim a business action succeeded unless a confirmed tool result says so.
For analysis, explain the important reason and the next action; do not expose hidden chain-of-thought.
${memoryBlock}${knowledgeBlock}${graphBlock}${screenBlock}${packBlock}`;

    if (!plannedCalls.length) {
      activity('thinking', plan.task === 'reasoning' ? 'Thinking through the problem…' : plan.task === 'code' ? 'Working through the code…' : 'Generating the answer…');
      const options = {
        messages: [
          { role: 'system' as const, content: baseSystem },
          ...relevantHistory,
          { role: 'user' as const, content: message },
        ],
        mode,
        task: plan.task,
        maxTokens: mode === 'fast' ? 640 : undefined,
      };
      let startedReply = false;
      const tokenSink = onToken
        ? (token: string) => {
            if (!startedReply) {
              startedReply = true;
              activity('responding', 'Writing the answer…');
            }
            onToken(token);
          }
        : undefined;
      const result = tokenSink
        ? await this.ai.chatCompletionStream(options, tokenSink)
        : await this.ai.chatCompletion(options);
      return {
        reply: result.content,
        specialist,
        data: { router: { domain: plan.domain, task: plan.task, source: plan.source, confidence: plan.confidence }, model: result.model, provider: result.provider, performance: result.performance },
        confidence: knowledge.length || graphMemory.length ? Math.max(0.72, plan.confidence || 0) : Math.max(0.55, plan.confidence || 0),
        citations: [
          ...knowledge.map((item) => ({ kind: 'document' as const, label: item.title, ref: item.documentId })),
          ...graphMemory.slice(0, 4).map((item) => ({ kind: 'memory' as const, label: item.label, ref: item.id })),
          ...(requestContext.entityLabel ? [{ kind: 'screen' as const, label: requestContext.entityLabel, ref: requestContext.entityId }] : []),
        ],
        needsVerification: !knowledge.length && !graphMemory.length && (plan.confidence || 0) < 0.65,
        pendingAction: null,
      };
    }

    // Write/outward actions remain confirmation-gated. If the router planned one,
    // prepare it before running any reads so nothing mutating can be hidden inside
    // a multi-tool plan.
    for (const call of plannedCalls) {
      const tool = this.tools.find((candidate) => candidate.name === call.tool);
      if (!tool?.write) continue;
      activity('preparing_action', `Preparing ${tool.name.replace(/_/g, ' ')} for confirmation…`);
      const result = await tool.run(ownerId, call.args);
      if ('pendingAction' in result) {
        const reply = `Ready to ${result.pendingAction.summary.toLowerCase()}. Confirm to proceed.`;
        if (onToken) onToken(reply);
        return {
          reply, used: tool.name, specialist, pendingAction: result.pendingAction,
          confidence: 0.96,
          citations: [{ kind: 'tool', label: tool.name.replace(/_/g, ' '), ref: tool.name }],
          needsVerification: false,
        };
      }
    }

    const readCalls: Array<{ call: { tool: string; args: Record<string, unknown> }; tool: Tool }> = [];
    for (const call of plannedCalls) {
      const tool = this.tools.find((candidate) => candidate.name === call.tool);
      if (tool && !tool.write) readCalls.push({ call, tool });
    }

    if (readCalls.length) {
      activity(
        'checking_data',
        readCalls.length === 1
          ? `Checking ${readCalls[0].tool.name.replace(/_/g, ' ')}…`
          : `Checking ${readCalls.length} business data sources in parallel…`,
        readCalls.map(({ tool }) => tool.name).join(', '),
      );
    }

    const executed = await Promise.all(
      readCalls.map(async ({ call, tool }) => ({
        tool: tool.name,
        result: await this.runToolCached(ownerId, tool, call.args),
      })),
    );

    const dataResults = executed
      .filter((item): item is { tool: string; result: { data: unknown } } => 'data' in item.result)
      .map((item) => ({ tool: item.tool, data: item.result.data }));

    if (dataResults.length === 1) {
      const direct = this.directToolSummary(dataResults[0].tool, dataResults[0].data);
      if (direct) {
        activity('responding', 'Formatting verified business data…');
        if (onToken) onToken(direct);
        return {
          reply: direct,
          used: dataResults[0].tool,
          specialist,
          data: dataResults[0].data,
          confidence: 0.99,
          citations: [{ kind: 'tool', label: dataResults[0].tool.replace(/_/g, ' '), ref: dataResults[0].tool }],
          needsVerification: false,
          pendingAction: null,
        };
      }
    }

    if (!dataResults.length) {
      const reply = 'I could not retrieve the business data needed for that answer.';
      if (onToken) onToken(reply);
      return { reply, specialist, confidence: 0.25, citations: [], needsVerification: true, pendingAction: null };
    }

    const toolContext = dataResults
      .map((item) => `Tool ${item.tool}: ${JSON.stringify(item.data)}`)
      .join('\n');
    const synthesisMessages = [
      { role: 'system' as const, content: `${baseSystem}
The verified KobeOS tool results below are the source of truth. Combine them into one answer. Do not invent missing numbers.` },
      ...relevantHistory,
      { role: 'user' as const, content: message },
      { role: 'user' as const, content: `Verified KobeOS data:\n${toolContext}` },
    ];
    const synthesisTask = dataResults.length > 1 ? 'reasoning' as const : plan.task;
    activity('thinking', dataResults.length > 1 ? 'Combining the verified results…' : 'Interpreting the verified result…');
    let startedSynthesis = false;
    const synthesisSink = onToken
      ? (token: string) => {
          if (!startedSynthesis) {
            startedSynthesis = true;
            activity('responding', 'Writing the answer…');
          }
          onToken(token);
        }
      : undefined;
    const result = synthesisSink
      ? await this.ai.chatCompletionStream({ messages: synthesisMessages, mode, task: synthesisTask }, synthesisSink)
      : await this.ai.chatCompletion({ messages: synthesisMessages, mode, task: synthesisTask });

    return {
      reply: result.content,
      used: dataResults.map((item) => item.tool).join(','),
      specialist,
      data: {
        results: dataResults,
        router: { domain: plan.domain, task: plan.task, source: plan.source, confidence: plan.confidence },
        model: result.model,
        provider: result.provider,
        performance: result.performance,
      },
      confidence: Math.max(0.78, plan.confidence || 0),
      citations: [
        ...dataResults.map((item) => ({ kind: 'tool' as const, label: item.tool.replace(/_/g, ' '), ref: item.tool })),
        ...knowledge.map((item) => ({ kind: 'document' as const, label: item.title, ref: item.documentId })),
        ...graphMemory.slice(0, 4).map((item) => ({ kind: 'memory' as const, label: item.label, ref: item.id })),
      ],
      needsVerification: Boolean(dataResults.some((item) => {
        const data = item.data as { weak?: boolean } | null;
        return Boolean(data && typeof data === 'object' && data.weak);
      })),
      pendingAction: null,
    };
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
      case 'business_health': return `Business health: today sales TZS ${Number(data.salesToday).toLocaleString()}, month expenses TZS ${Number(data.expensesMonth).toLocaleString()}, outstanding rent TZS ${Number(data.outstandingRent).toLocaleString()}, hotel occupancy ${data.hotel?.occupancyRate ?? 0}%, ${data.inventory?.lowStock ?? 0} low-stock item(s), ${data.cargo?.total ?? 0} cargo parcel(s).`;
      case 'semantic_search': return data.count ? `Found ${data.count} match(es): ${data.results.slice(0, 5).map((r: any) => r.text.slice(0, 40)).join('; ')}.` : (data.note || 'No matches found.');
      case 'remember': return data.saved ? `Got it — I'll remember that.` : (data.note || 'Nothing to remember.');
      case 'search_documents': return data.count ? `Found ${data.count} relevant passage(s) in your documents${data.passages?.[0]?.title ? ` (e.g. "${data.passages[0].title}")` : ''}.` : (data.note || 'Nothing found in your documents.');
      case 'diagnose_system': return `System status: ${data.mode}. ${Array.isArray(data.advice) ? data.advice.join(' ') : data.message}`;
      default: return JSON.stringify(data);
    }
  }
}
