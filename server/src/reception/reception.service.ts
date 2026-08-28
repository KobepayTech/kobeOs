import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { HotelMenuItem, HotelOrder } from '../hotel/hotel.entity';
import { PlatformNotificationService } from '../platform/platform.service';
import {
  CartLine, FaqEntry, Receptionist, ReceptionLead, ReceptionMessage, ReceptionSession,
} from './reception.entity';

const money = (n: number, ccy: string) => `${ccy} ${Number(n).toLocaleString()}`;

/** The Kobe AI Receptionist engine. Deterministic slot-filling core (works with
 * no LLM); the LLM enhances free-form answers when one is configured. */
@Injectable()
export class ReceptionService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Receptionist) private readonly receptionists: Repository<Receptionist>,
    @InjectRepository(ReceptionSession) private readonly sessions: Repository<ReceptionSession>,
    @InjectRepository(ReceptionMessage) private readonly messages: Repository<ReceptionMessage>,
    @InjectRepository(ReceptionLead) private readonly leads: Repository<ReceptionLead>,
    private readonly notifications: PlatformNotificationService,
  ) {}

  // ── Owner configuration ─────────────────────────────────────────────────────

  async upsert(ownerId: string, dto: Partial<Receptionist> & { slug: string; businessName: string }) {
    const slug = dto.slug.trim().toLowerCase();
    let row = await this.receptionists.findOne({ where: { ownerId, slug } });
    const clash = await this.receptionists.findOne({ where: { slug } });
    if (clash && clash.ownerId !== ownerId) throw new BadRequestException('That receptionist slug is taken');
    row ??= this.receptionists.create({ ownerId, slug });
    Object.assign(row, {
      ...dto, slug, ownerId,
      greeting: dto.greeting ?? row.greeting ?? `Hi! Welcome to ${dto.businessName}. How can I help — menu, an order, or a question?`,
    });
    return this.receptionists.save(row);
  }

  listMine(ownerId: string) { return this.receptionists.find({ where: { ownerId }, order: { createdAt: 'DESC' } }); }
  async leadsFor(ownerId: string, receptionistId: string) {
    const r = await this.receptionists.findOne({ where: { id: receptionistId, ownerId } });
    if (!r) throw new NotFoundException('Receptionist not found');
    return this.leads.find({ where: { receptionistId }, order: { createdAt: 'DESC' } });
  }

  // ── Public: resolve + menu ──────────────────────────────────────────────────

  private async bySlug(slug: string): Promise<Receptionist> {
    const r = await this.receptionists.findOne({ where: { slug: slug.trim().toLowerCase(), enabled: true } });
    if (!r) throw new NotFoundException('Receptionist not found');
    return r;
  }

  private menuRepo() { return this.ds.getRepository(HotelMenuItem); }

  private async menu(r: Receptionist): Promise<HotelMenuItem[]> {
    if (!r.hotelId) return [];
    return this.menuRepo().find({ where: [
      { ownerId: r.ownerId, hotelId: r.hotelId, available: true },
      { ownerId: r.ownerId, hotelId: IsNull(), available: true },
    ] });
  }

  async publicProfile(slug: string) {
    const r = await this.bySlug(slug);
    const menu = await this.menu(r);
    return {
      businessName: r.businessName, greeting: r.greeting, hours: r.hoursText,
      capabilities: r.capabilities, currency: r.currency, voiceEnabled: r.voiceEnabled,
      menu: menu.map((m) => ({ id: m.id, name: m.name, category: m.category, price: Number(m.price), station: m.station })),
    };
  }

  // ── The conversation engine ─────────────────────────────────────────────────

  async message(slug: string, input: { sessionId?: string; text: string; channel?: ReceptionSession['channel']; customer?: { name?: string; phone?: string } }) {
    const r = await this.bySlug(slug);
    const session = await this.loadSession(r.id, input);
    if (input.customer?.name) session.customerName = input.customer.name.trim();
    if (input.customer?.phone) session.customerPhone = input.customer.phone.trim();
    const text = (input.text || '').trim();
    await this.messages.save(this.messages.create({ sessionId: session.id, role: 'customer', text }));

    const result = await this.route(r, session, text);
    await this.sessions.save(session);
    await this.messages.save(this.messages.create({ sessionId: session.id, role: 'assistant', text: result.reply }));
    return { sessionId: session.id, ...result };
  }

  private async loadSession(receptionistId: string, input: { sessionId?: string; channel?: ReceptionSession['channel'] }) {
    if (input.sessionId) {
      const s = await this.sessions.findOne({ where: { id: input.sessionId, receptionistId } });
      if (s) return s;
    }
    return this.sessions.save(this.sessions.create({ receptionistId, channel: input.channel ?? 'web', context: { cart: [] } }));
  }

  private async route(r: Receptionist, s: ReceptionSession, text: string): Promise<{ reply: string; handedOff?: boolean; order?: { id: string; total: number }; cart?: CartLine[]; intent: string }> {
    const t = text.toLowerCase();
    const cart = s.context.cart ?? (s.context.cart = []);

    // Human hand-off (explicit or complaint).
    if (/\b(human|agent|manager|speak to|talk to someone|complain|complaint|help me)\b/.test(t)) {
      await this.handOff(r, s, text);
      return { reply: `No problem — I've asked ${r.businessName} to reach out to you${s.customerPhone ? ` on ${s.customerPhone}` : ''}. Anything else meanwhile?`, handedOff: true, intent: 'handoff' };
    }

    // Order status.
    if (r.capabilities.status && /\b(status|where.?s? my|track|my order|ready yet)\b/.test(t)) {
      return { reply: await this.statusReply(r, s), intent: 'status' };
    }

    // Checkout / confirm an order.
    if (r.capabilities.order && /\b(done|checkout|confirm|that.?s all|finish|place( the)? order|order now)\b/.test(t)) {
      return this.checkout(r, s);
    }

    // Menu request.
    if (r.capabilities.order && /\b(menu|what do you have|what.?s available|food|eat|drinks?)\b/.test(t)) {
      const menu = await this.menu(r);
      if (!menu.length) return { reply: 'Our menu is being set up — I can take your details and have someone call you.', intent: 'menu' };
      const list = menu.slice(0, 20).map((m) => `• ${m.name} — ${money(Number(m.price), r.currency)}`).join('\n');
      return { reply: `Here's what we have:\n${list}\n\nTell me what you'd like (e.g. "2 ${menu[0].name}").`, intent: 'menu' };
    }

    // Try to add ordered items.
    if (r.capabilities.order) {
      const added = await this.parseOrder(r, text);
      if (added.length) {
        for (const line of added) {
          const existing = cart.find((c) => c.menuItemId === line.menuItemId);
          if (existing) existing.qty += line.qty; else cart.push(line);
        }
        s.context.stage = 'ordering';
        return { reply: `${this.cartSummary(cart, r.currency)}\nAnything else? Say "done" to place the order.`, cart, intent: 'order_add' };
      }
    }

    // FAQ (configured, then LLM-enhanced if available).
    if (r.capabilities.faq) {
      const hit = this.matchFaq(r.faq, t);
      if (hit) return { reply: hit.a, intent: 'faq' };
      if (/\b(open|hours|time|location|where are you|address)\b/.test(t) && r.hoursText) return { reply: r.hoursText, intent: 'faq' };
    }

    // Fallback: greet + guide.
    return { reply: `${s.context.stage ? '' : r.greeting + ' '}I can share our menu, take your order, check an order's status, or connect you to the team. What would you like?`, intent: 'fallback' };
  }

  private cartSummary(cart: CartLine[], ccy: string): string {
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const lines = cart.map((c) => `• ${c.qty} × ${c.name} — ${money(c.price * c.qty, ccy)}`).join('\n');
    return `Your order so far:\n${lines}\nTotal: ${money(total, ccy)}`;
  }

  private async parseOrder(r: Receptionist, text: string): Promise<CartLine[]> {
    const menu = await this.menu(r);
    const t = text.toLowerCase();
    const out: CartLine[] = [];
    for (const m of menu) {
      const name = m.name.toLowerCase();
      if (!t.includes(name)) continue;
      // Optional leading quantity: "2 nyama choma".
      const qm = new RegExp(`(\\d+)\\s*(?:x|\\*)?\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(t);
      const qty = qm ? Math.max(1, parseInt(qm[1], 10)) : 1;
      out.push({ menuItemId: m.id, name: m.name, qty, price: Number(m.price), station: m.station });
    }
    return out;
  }

  private async checkout(r: Receptionist, s: ReceptionSession): Promise<{ reply: string; order?: { id: string; total: number }; intent: string }> {
    const cart = s.context.cart ?? [];
    if (!cart.length) return { reply: "Your order is empty — tell me what you'd like and I'll add it.", intent: 'checkout' };
    if (!s.customerName || !s.customerPhone) {
      s.context.stage = 'awaiting_contact';
      return { reply: 'Great — to place the order I just need your name and phone number.', intent: 'need_contact' };
    }
    const total = Math.round(cart.reduce((sum, c) => sum + c.price * c.qty, 0) * 100) / 100;
    const order = await this.ds.getRepository(HotelOrder).save(this.ds.getRepository(HotelOrder).create({
      ownerId: r.ownerId, hotelId: r.hotelId ?? null, roomNumber: 'Reception', locationType: 'pickup',
      guestName: s.customerName, guestPhone: s.customerPhone,
      items: cart.map((c) => ({ menuItemId: c.menuItemId, name: c.name, qty: c.qty, price: c.price, station: (c.station as 'kitchen' | 'bar' | 'other') })),
      total, currency: r.currency, status: 'PENDING', note: 'Order via Kobe AI Receptionist',
    }));
    s.context.cart = []; s.context.stage = 'ordered';
    await this.notify(r, `New order from ${s.customerName} (${s.customerPhone}) — ${money(total, r.currency)}`, s.customerPhone);
    return { reply: `Order confirmed! ${this.cartSummary(cart, r.currency)}\nWe'll have it ready shortly and call ${s.customerPhone} if needed. Your reference is ${order.id.slice(0, 8).toUpperCase()}.`, order: { id: order.id, total }, intent: 'ordered' };
  }

  private async statusReply(r: Receptionist, s: ReceptionSession): Promise<string> {
    if (!s.customerPhone) return "Sure — what's the phone number you ordered with?";
    const order = await this.ds.getRepository(HotelOrder).findOne({ where: { ownerId: r.ownerId, guestPhone: s.customerPhone }, order: { createdAt: 'DESC' } });
    if (!order) return `I couldn't find a recent order for ${s.customerPhone}. Want to place one?`;
    const human: Record<string, string> = { PENDING: 'received and queued', ACCEPTED: 'accepted by the kitchen', PREPARING: 'being prepared', READY: 'ready for pickup', DELIVERED: 'delivered', CANCELLED: 'cancelled' };
    return `Your order (${order.id.slice(0, 8).toUpperCase()}) is ${human[order.status] ?? order.status.toLowerCase()}. Total ${money(Number(order.total), r.currency)}.`;
  }

  private matchFaq(faq: FaqEntry[], t: string): FaqEntry | null {
    let best: { e: FaqEntry; score: number } | null = null;
    for (const e of faq) {
      const words = e.q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
      const score = words.filter((w) => t.includes(w)).length;
      if (score > 0 && (!best || score > best.score)) best = { e, score };
    }
    return best?.e ?? null;
  }

  private async handOff(r: Receptionist, s: ReceptionSession, summary: string) {
    s.status = 'HANDED_OFF';
    await this.leads.save(this.leads.create({ receptionistId: r.id, sessionId: s.id, name: s.customerName, phone: s.customerPhone, summary: summary.slice(0, 500), status: 'NEW' }));
    await this.notify(r, `A customer wants a callback: "${summary.slice(0, 120)}"${s.customerPhone ? ` — ${s.customerPhone}` : ''}`, s.customerPhone);
  }

  private async notify(r: Receptionist, body: string, customerPhone: string) {
    try {
      await this.notifications.send({
        ownerId: r.ownerId, recipientKey: r.id, phone: r.handoffPhone || undefined,
        title: `${r.businessName} · reception`, body,
        actionUrl: '/erp', channels: ['IN_APP', 'PUSH', ...(r.handoffPhone ? ['SMS', 'WHATSAPP'] as const : [])],
      });
    } catch { /* notification is best-effort */ }
    void customerPhone;
  }
}
