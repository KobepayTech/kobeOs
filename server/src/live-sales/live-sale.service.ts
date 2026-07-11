import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { LiveSession, LivePin, LiveComment } from './live-sale.entity';
import { PosProduct } from '../pos/pos.entity';
import { OrdersService } from '../pos/pos.service';
import { PalmPesaService } from '../creators/palmpesa.service';

const num = (v: unknown) => Number(v) || 0;

export interface IngestInput {
  source?: string;
  buyerHandle?: string;
  buyerContact?: string;
  text: string;
}

@Injectable()
export class LiveSaleService {
  private readonly logger = new Logger(LiveSaleService.name);

  constructor(
    @InjectRepository(LiveSession) private readonly sessions: Repository<LiveSession>,
    @InjectRepository(LivePin) private readonly pins: Repository<LivePin>,
    @InjectRepository(LiveComment) private readonly comments: Repository<LiveComment>,
    @InjectRepository(PosProduct) private readonly products: Repository<PosProduct>,
    private readonly orders: OrdersService,
    private readonly palmpesa: PalmPesaService,
  ) {}

  /* ── Sessions ── */

  async startSession(uid: string, dto: { title?: string; platform?: string; currency?: string }) {
    return this.sessions.save(this.sessions.create({
      ownerId: uid,
      title: dto.title?.trim() || 'Live Sale',
      platform: (dto.platform as LiveSession['platform']) || 'other',
      currency: dto.currency || 'TZS',
      status: 'LIVE',
      ingestToken: randomBytes(12).toString('hex'),
    }));
  }

  listSessions(uid: string) {
    return this.sessions.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async getSession(uid: string, id: string) {
    const s = await this.sessions.findOne({ where: { ownerId: uid, id } });
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  async endSession(uid: string, id: string) {
    const s = await this.getSession(uid, id);
    s.status = 'ENDED';
    s.endedAt = new Date();
    return this.sessions.save(s);
  }

  /* ── Pins ── */

  async pinProduct(uid: string, sessionId: string, dto: { productId: string; code: string; livePrice?: number }) {
    await this.getSession(uid, sessionId);
    const product = await this.products.findOne({ where: { ownerId: uid, id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('A buy-code is required');
    const dupe = await this.pins.findOne({ where: { sessionId, code } });
    if (dupe) throw new BadRequestException(`Code "${code}" is already used in this session`);
    return this.pins.save(this.pins.create({
      ownerId: uid, sessionId, productId: product.id, code,
      name: product.name, livePrice: num(dto.livePrice),
    }));
  }

  async listPins(uid: string, sessionId: string) {
    const pins = await this.pins.find({ where: { ownerId: uid, sessionId }, order: { code: 'ASC' } });
    // Enrich with live remaining stock + catalog price.
    const out: Array<{ id: string; code: string; productId: string; name: string; livePrice: number; catalogPrice: number; stock: number; soldQty: number }> = [];
    for (const p of pins) {
      const prod = await this.products.findOne({ where: { ownerId: uid, id: p.productId } });
      out.push({
        id: p.id, code: p.code, productId: p.productId, name: p.name,
        livePrice: num(p.livePrice), catalogPrice: prod ? num(prod.price) : 0,
        stock: prod ? Number(prod.stock) : 0, soldQty: p.soldQty,
      });
    }
    return out;
  }

  async unpin(uid: string, sessionId: string, pinId: string) {
    const p = await this.pins.findOne({ where: { ownerId: uid, sessionId, id: pinId } });
    if (!p) throw new NotFoundException('Pin not found');
    await this.pins.remove(p);
    return { removed: true };
  }

  /* ── Comment ingest + parsing ── */

  /** Parse a comment against the session's pins. Finds the first pin whose
   *  code appears as a token, and a quantity if one sits next to it. */
  private async parse(uid: string, sessionId: string, text: string) {
    const pins = await this.pins.find({ where: { ownerId: uid, sessionId } });
    const upper = ` ${text.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')} `;
    for (const p of pins) {
      const idx = upper.indexOf(` ${p.code} `);
      if (idx >= 0) {
        // Quantity: a number immediately after the code, else 1.
        const after = upper.slice(idx + p.code.length + 2);
        const m = after.match(/^\s*(?:X\s*)?(\d{1,3})\b/);
        const qty = m ? Math.max(1, parseInt(m[1], 10)) : 1;
        return { code: p.code, productId: p.productId, qty };
      }
    }
    return null;
  }

  async ingestComment(uid: string, sessionId: string, dto: IngestInput) {
    const session = await this.getSession(uid, sessionId);
    if (session.status !== 'LIVE') throw new BadRequestException('Session has ended');
    const match = await this.parse(uid, sessionId, dto.text || '');
    return this.comments.save(this.comments.create({
      ownerId: uid, sessionId,
      source: dto.source || 'manual',
      buyerHandle: dto.buyerHandle?.trim() || '',
      buyerContact: dto.buyerContact?.trim() || '',
      text: dto.text || '',
      matchedCode: match?.code || '',
      matchedProductId: match?.productId || null,
      qty: match?.qty || 1,
      status: match ? 'MATCHED' : 'NEW',
    }));
  }

  listComments(uid: string, sessionId: string) {
    return this.comments.find({ where: { ownerId: uid, sessionId }, order: { createdAt: 'DESC' }, take: 300 });
  }

  async ignoreComment(uid: string, commentId: string) {
    const c = await this.comments.findOne({ where: { ownerId: uid, id: commentId } });
    if (!c) throw new NotFoundException('Comment not found');
    c.status = 'IGNORED';
    return this.comments.save(c);
  }

  /* ── The sale: comment → order → stock decrement → payment ── */

  async convert(uid: string, commentId: string, dto: { qty?: number; buyerContact?: string; code?: string }) {
    const c = await this.comments.findOne({ where: { ownerId: uid, id: commentId } });
    if (!c) throw new NotFoundException('Comment not found');
    if (c.status === 'CONVERTED') throw new BadRequestException('Already converted to a sale');

    // Resolve the pin — allow an operator override of the code.
    const code = (dto.code || c.matchedCode || '').toUpperCase();
    const pin = code
      ? await this.pins.findOne({ where: { ownerId: uid, sessionId: c.sessionId, code } })
      : (c.matchedProductId ? await this.pins.findOne({ where: { ownerId: uid, sessionId: c.sessionId, productId: c.matchedProductId } }) : null);
    if (!pin) throw new BadRequestException('No product matched — set a buy-code first');

    const qty = Math.max(1, Number(dto.qty) || c.qty || 1);
    const product = await this.products.findOne({ where: { ownerId: uid, id: pin.productId } });
    if (!product) throw new NotFoundException('Product no longer exists');
    const catalog = num(product.price);
    const live = num(pin.livePrice);
    // negotiatedPrice can't exceed catalog (OrdersService rejects markups).
    const negotiatedPrice = live > 0 && live <= catalog ? live : undefined;
    const contact = (dto.buyerContact || c.buyerContact || '').trim();

    let order;
    try {
      order = await this.orders.create(uid, {
        orderNumber: `LIVE-${Date.now().toString().slice(-8)}-${randomBytes(2).toString('hex')}`,
        lines: [{ productId: pin.productId, quantity: qty, negotiatedPrice }],
        paymentMethod: 'live',
        customerName: c.buyerHandle || 'Live buyer',
        customerPhone: contact,
      } as Parameters<OrdersService['create']>[1]);
    } catch (e) {
      c.status = 'FAILED';
      c.note = (e as Error).message;
      await this.comments.save(c);
      throw new BadRequestException((e as Error).message || 'Could not create the sale');
    }

    // Mark everything sold.
    const unit = negotiatedPrice ?? (live > 0 ? live : catalog);
    const lineTotal = unit * qty;
    pin.soldQty += qty;
    await this.pins.save(pin);
    c.status = 'CONVERTED';
    c.orderId = (order as { id: string }).id;
    c.qty = qty;
    c.buyerContact = contact;
    await this.comments.save(c);
    const session = await this.getSession(uid, c.sessionId);
    session.totalSales = num(session.totalSales) + lineTotal;
    session.orderCount += 1;
    await this.sessions.save(session);

    // Best-effort PalmPesa payment request to the buyer's phone.
    let payment: { requested: boolean; message: string } = { requested: false, message: 'Sale recorded. Collect payment manually.' };
    if (contact) {
      try {
        await this.palmpesa.initiatePayment({
          name: c.buyerHandle || 'Live buyer', email: '', phone: contact,
          amountTzs: lineTotal, transactionId: `LIVE-${c.id}`,
          description: `${pin.name} x${qty} (live sale)`,
        });
        payment = { requested: true, message: 'Payment request sent to the buyer’s phone.' };
      } catch { /* gateway down — manual collection */ }
    }

    return {
      ok: true,
      order,
      lineTotal,
      remainingStock: product ? Number(product.stock) - qty : null,
      payment,
    };
  }

  /* ── Stats ── */

  async stats(uid: string, sessionId: string) {
    const session = await this.getSession(uid, sessionId);
    const pins = await this.listPins(uid, sessionId);
    const comments = await this.comments.find({ where: { ownerId: uid, sessionId } });
    const converted = comments.filter((c) => c.status === 'CONVERTED');
    return {
      session,
      totalSales: num(session.totalSales),
      orderCount: session.orderCount,
      pendingComments: comments.filter((c) => c.status === 'MATCHED' || c.status === 'NEW').length,
      convertedComments: converted.length,
      pins,
    };
  }

  /* ── Public bridge ingest (token-scoped, no JWT) ── */

  async ingestByToken(token: string, dto: IngestInput) {
    const session = await this.sessions.findOne({ where: { ingestToken: token } });
    if (!session) throw new NotFoundException('Invalid ingest token');
    if (session.status !== 'LIVE') throw new BadRequestException('Session has ended');
    return this.ingestComment(session.ownerId, session.id, { ...dto, source: dto.source || 'bridge' });
  }
}
