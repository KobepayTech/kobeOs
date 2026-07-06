import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { AiService } from './ai.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge, Tenant, PropertyUnit } from '../property/property.entity';
import { HotelRoom } from '../hotel/hotel.entity';
import { HotelFinancialRecord } from '../hotel/hotel-financials.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { ShopExpense, ExpenseCategory } from '../eod/eod.entity';
import { Parcel } from '../cargo/cargo.entity';
import { Shop } from '../shops/shop.entity';
import { BeemService } from '../notifications/beem.service';

export interface AgentReply {
  reply: string;
  used?: string;                 // tool that was called (if any)
  data?: unknown;                // raw tool result (for the UI to render tables/print)
  pendingAction?: {              // a write the user must CONFIRM before it runs
    tool: string;
    summary: string;
    args: Record<string, unknown>;
  } | null;
}

type ToolResult = { data: unknown } | { pendingAction: NonNullable<AgentReply['pendingAction']> };

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
    @InjectRepository(HotelFinancialRecord) private readonly hotelFin: Repository<HotelFinancialRecord>,
    @InjectRepository(WarehouseItem) private readonly whItems: Repository<WarehouseItem>,
    @InjectRepository(ShopExpense) private readonly expenses: Repository<ShopExpense>,
    @InjectRepository(Parcel) private readonly parcels: Repository<Parcel>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    private readonly beem: BeemService,
  ) {}

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

    return { ok: false, message: `Unknown action "${action.tool}".` };
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
  ];

  private toolList(): string {
    return this.tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
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
    const system = `You are Kobe, a concise business assistant inside KobeOS. Answer questions about the owner's shop/property using ONLY the tools below.
When you need data, reply with EXACTLY one JSON object and nothing else: {"tool":"<name>","args":{...}}.
After you receive the tool result, answer the user in plain language (short, with the key numbers). If no tool is needed, just answer.
Tools:
${this.toolList()}`;

    const first = await this.ai.chatCompletion({
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: message }],
    }).catch((e) => { this.logger.warn(`LLM error: ${(e as Error).message}`); return { content: '' } as { content: string }; });

    const call = this.extractToolCall(first.content || '');
    if (!call) return { reply: (first.content || '').trim() || "I couldn't reach the local AI model. Is Ollama running?", pendingAction: null };

    const tool = this.tools.find((t) => t.name === call.tool);
    if (!tool) return { reply: first.content.trim(), pendingAction: null };

    const result = await tool.run(ownerId, call.args);
    if ('pendingAction' in result) {
      return { reply: `Ready to ${result.pendingAction.summary.toLowerCase()}. Confirm to proceed.`, used: tool.name, pendingAction: result.pendingAction };
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
    return { reply, used: tool.name, data: result.data, pendingAction: null };
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
      default: return JSON.stringify(data);
    }
  }
}
