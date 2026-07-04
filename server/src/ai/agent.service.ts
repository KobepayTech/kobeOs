import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { AiService } from './ai.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge, Tenant } from '../property/property.entity';

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
  ) {}

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
      default: return JSON.stringify(data);
    }
  }
}
