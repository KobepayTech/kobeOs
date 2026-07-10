import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { PayoutReceipt, PayoutMethod } from './payout-receipt.entity';
import { CreateReceiptDto, PayReceiptDto } from './dto/payout-receipt.dto';
import { KobePayRbacService, AuditContext } from './kobepay-rbac.service';

const METHODS: PayoutMethod[] = ['Cash', 'Bank', 'WeChat', 'Alipay', 'Other'];

/** Local-day key (YYYY-MM-DD) for grouping. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
const num = (v: unknown) => Number(v) || 0;

@Injectable()
export class KobePayReceiptsService {
  constructor(
    @InjectRepository(PayoutReceipt) private readonly receipts: Repository<PayoutReceipt>,
    private readonly rbac: KobePayRbacService,
  ) {}

  /* ── Reads ── */

  async list(uid: string, opts: { status?: 'Pending' | 'Paid'; q?: string } = {}) {
    const qb = this.receipts.createQueryBuilder('r')
      .where('r.ownerId = :uid', { uid })
      .orderBy('r.createdAt', 'DESC')
      .take(500);
    if (opts.status) qb.andWhere('r.status = :s', { s: opts.status });
    if (opts.q?.trim()) {
      const q = `%${opts.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(r.receiptNumber) LIKE :q OR LOWER(r.supplierName) LIKE :q OR LOWER(r.customerName) LIKE :q)',
        { q },
      );
    }
    return qb.getMany();
  }

  /** Look up by receipt number (the China cashier scan / manual-entry path). */
  async getByNumber(uid: string, receiptNumber: string) {
    const r = await this.receipts.findOne({
      where: { ownerId: uid, receiptNumber: receiptNumber.trim().toUpperCase() },
    });
    if (!r) throw new NotFoundException(`No receipt "${receiptNumber}"`);
    return r;
  }

  /** Authed lookup by QR token (owner-scoped) — the in-app scanner path,
   *  returns the full row so the cashier can pay it. */
  async getByTokenOwned(uid: string, token: string) {
    const r = await this.receipts.findOne({ where: { ownerId: uid, publicToken: token } });
    if (!r) throw new NotFoundException('Receipt not found');
    return r;
  }

  /** Public receipt view keyed by the QR token — no owner scope, so the
   *  token itself is the capability. Returns a trimmed, read-only shape. */
  async getPublic(token: string) {
    const r = await this.receipts.findOne({ where: { publicToken: token } });
    if (!r) throw new NotFoundException('Receipt not found');
    return {
      receiptNumber: r.receiptNumber,
      customerName: r.customerName,
      supplierName: r.supplierName,
      items: r.items ?? [],
      itemCount: r.itemCount,
      amountDue: num(r.amountDue),
      shipping: num(r.shipping),
      serviceFee: num(r.serviceFee),
      total: num(r.total),
      currency: r.currency,
      status: r.status,
      createdAt: r.createdAt,
      paidByName: r.paidByName || null,
      paidAt: r.paidAt || null,
    };
  }

  /* ── Writes ── */

  /** Generate the next KP-YYYY-NNNNNN number for this owner. The `offset`
   *  advances the sequence on a retry so a unique-index collision from a
   *  concurrent insert resolves instead of re-proposing the same number. */
  private async nextReceiptNumber(uid: string, offset = 0): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `KP-${year}-`;
    const count = await this.receipts.count({ where: { ownerId: uid } });
    // Base the sequence on the owner's total so numbers grow monotonically;
    // the unique index catches the rare race and the caller retries.
    return `${prefix}${String(count + 1 + offset).padStart(6, '0')}`;
  }

  async create(uid: string, ctx: AuditContext, dto: CreateReceiptDto) {
    const amountDue = num(dto.amountDue);
    const shipping = num(dto.shipping);
    const serviceFee = num(dto.serviceFee);
    const total = amountDue + shipping + serviceFee;
    const items = dto.items ?? [];

    // Retry the number allocation a few times to survive a concurrent insert.
    for (let attempt = 0; attempt < 5; attempt++) {
      const receiptNumber = await this.nextReceiptNumber(uid, attempt);
      try {
        const saved = await this.receipts.save(this.receipts.create({
          ownerId: uid,
          receiptNumber,
          publicToken: randomBytes(12).toString('hex'),
          customerName: dto.customerName ?? '',
          customerPhone: dto.customerPhone ?? '',
          supplierId: dto.supplierId ?? null,
          supplierName: dto.supplierName,
          supplierPhone: dto.supplierPhone ?? '',
          items,
          itemCount: items.reduce((s, it) => s + (Number(it.qty) || 0), 0),
          amountDue, shipping, serviceFee, total,
          currency: dto.currency ?? 'CNY',
          status: 'Pending',
          createdByName: dto.createdByName ?? ctx.user?.name ?? '',
        }));
        await this.rbac.record(uid, ctx, 'receipt.create', 'payout_receipt', saved.id, {
          receiptNumber, supplierName: dto.supplierName, total,
        });
        return saved;
      } catch (e) {
        // Unique violation on receiptNumber — loop and try the next number.
        if (attempt === 4) throw e;
      }
    }
    throw new BadRequestException('Could not allocate a receipt number');
  }

  /**
   * Pay a receipt (China cashier). Gated by payout.markPaid so a Tanzania
   * cashier physically cannot complete a payout. Amount is never taken from
   * the request — it's the receipt's own total, so there's nothing to
   * mistype. Idempotent: paying an already-paid receipt is rejected.
   */
  async pay(uid: string, ctx: AuditContext, id: string, dto: PayReceiptDto) {
    this.rbac.ensure(ctx.user ?? null, 'payout.markPaid');
    const r = await this.receipts.findOne({ where: { ownerId: uid, id } });
    if (!r) throw new NotFoundException('Receipt not found');
    if (r.status === 'Paid') throw new BadRequestException(`Receipt ${r.receiptNumber} is already paid`);
    if (!METHODS.includes(dto.method)) throw new BadRequestException('Invalid payment method');

    r.status = 'Paid';
    r.paymentMethod = dto.method;
    r.transactionId = dto.transactionId ?? '';
    r.paidByUserId = ctx.user?.id ?? null;
    r.paidByName = ctx.user?.name ?? 'owner';
    r.paidAt = new Date();
    r.payoutNotes = dto.notes ?? '';
    const saved = await this.receipts.save(r);

    await this.rbac.record(uid, ctx, 'payout.markPaid', 'payout_receipt', saved.id, {
      receiptNumber: r.receiptNumber, method: dto.method, total: num(r.total), currency: r.currency,
    });
    return saved;
  }

  /* ── China Cashier dashboard ── */

  async dashboard(uid: string) {
    const rows = await this.receipts.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 5000 });
    const pending = rows.filter((r) => r.status === 'Pending');
    const paid = rows.filter((r) => r.status === 'Paid');
    const todayKey = dayKey(new Date());

    const paidTodayRows = paid.filter((r) => r.paidAt && dayKey(new Date(r.paidAt)) === todayKey);

    // Payouts by method (paid receipts only).
    const byMethod = METHODS.map((m) => ({
      method: m,
      amount: paid.filter((r) => r.paymentMethod === m).reduce((s, r) => s + num(r.total), 0),
      count: paid.filter((r) => r.paymentMethod === m).length,
    })).filter((x) => x.count > 0);

    // Daily trend — last 14 days of paid totals.
    const dailyTrend: { date: string; amount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = dayKey(d);
      dailyTrend.push({
        date: k.slice(5), // MM-DD
        amount: paid.filter((r) => r.paidAt && dayKey(new Date(r.paidAt)) === k).reduce((s, r) => s + num(r.total), 0),
      });
    }

    // Monthly trend — last 12 months.
    const monthlyTrend: { month: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const k = monthKey(d);
      monthlyTrend.push({
        month: k,
        amount: paid.filter((r) => r.paidAt && monthKey(new Date(r.paidAt)) === k).reduce((s, r) => s + num(r.total), 0),
      });
    }

    const currency = rows[0]?.currency ?? 'CNY';
    return {
      currency,
      cards: {
        pendingAmount: pending.reduce((s, r) => s + num(r.total), 0),
        pendingCount: pending.length,
        paidToday: paidTodayRows.reduce((s, r) => s + num(r.total), 0),
        paidTodayCount: paidTodayRows.length,
        totalPaid: paid.reduce((s, r) => s + num(r.total), 0),
        totalPaidCount: paid.length,
      },
      byMethod,
      pendingVsPaid: [
        { name: 'Pending', value: pending.reduce((s, r) => s + num(r.total), 0), count: pending.length },
        { name: 'Paid', value: paid.reduce((s, r) => s + num(r.total), 0), count: paid.length },
      ],
      dailyTrend,
      monthlyTrend,
    };
  }

  /* ── Admin analytics ── */

  async analytics(uid: string, filters: { from?: string; to?: string; method?: string; cashier?: string; supplier?: string } = {}) {
    const rows = await this.receipts.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 10000 });

    const fromT = filters.from ? new Date(filters.from).getTime() : -Infinity;
    const toT = filters.to ? new Date(filters.to).getTime() + 86_400_000 : Infinity;
    const filtered = rows.filter((r) => {
      const ref = r.paidAt ? new Date(r.paidAt).getTime() : new Date(r.createdAt).getTime();
      if (ref < fromT || ref > toT) return false;
      if (filters.method && r.paymentMethod !== filters.method) return false;
      if (filters.cashier && r.paidByName !== filters.cashier) return false;
      if (filters.supplier && !r.supplierName.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
      return true;
    });

    const paid = filtered.filter((r) => r.status === 'Paid');
    const pending = filtered.filter((r) => r.status === 'Pending');

    // Average payout time (createdAt → paidAt), in hours.
    const times = paid
      .filter((r) => r.paidAt)
      .map((r) => (new Date(r.paidAt!).getTime() - new Date(r.createdAt).getTime()) / 3_600_000)
      .filter((h) => h >= 0);
    const avgPayoutHours = times.length ? times.reduce((s, h) => s + h, 0) / times.length : 0;

    const groupSum = <K extends string>(keyFn: (r: PayoutReceipt) => K) => {
      const m = new Map<K, { amount: number; count: number }>();
      for (const r of paid) {
        const k = keyFn(r);
        const cur = m.get(k) ?? { amount: 0, count: 0 };
        cur.amount += num(r.total); cur.count += 1;
        m.set(k, cur);
      }
      return Array.from(m.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.amount - a.amount);
    };

    return {
      currency: rows[0]?.currency ?? 'CNY',
      totals: {
        pendingAmount: pending.reduce((s, r) => s + num(r.total), 0),
        pendingCount: pending.length,
        paidAmount: paid.reduce((s, r) => s + num(r.total), 0),
        paidCount: paid.length,
        avgPayoutHours: Math.round(avgPayoutHours * 10) / 10,
      },
      byCashier: groupSum((r) => (r.paidByName || 'owner') as string),
      byMethod: groupSum((r) => (r.paymentMethod || 'Other') as string),
      byDay: groupSum((r) => (r.paidAt ? dayKey(new Date(r.paidAt)) : dayKey(new Date(r.createdAt))) as string).sort((a, b) => a.key.localeCompare(b.key)),
      byMonth: groupSum((r) => (r.paidAt ? monthKey(new Date(r.paidAt)) : monthKey(new Date(r.createdAt))) as string).sort((a, b) => a.key.localeCompare(b.key)),
      rows: filtered.slice(0, 1000),
    };
  }

  /* ── Demo data (mockup the operator can replace later) ── */

  async seedDemo(uid: string, ctx: AuditContext) {
    const existing = await this.receipts.count({ where: { ownerId: uid } });
    if (existing > 0) return { created: 0, note: 'Receipts already exist — skipped.' };

    const suppliers = [
      { name: 'Shanghai Fashion Ltd', phone: '+86 138 0011 2200' },
      { name: 'Guangzhou Electronics Co', phone: '+86 139 0022 3311' },
      { name: 'Yiwu Trading House', phone: '+86 137 0033 4422' },
      { name: 'Shenzhen Gadgets Ltd', phone: '+86 136 0044 5533' },
    ];
    const customers = ['Stephen', 'Amina Hassan', 'John Mwangi', 'Grace Namuli', 'Faisal Rashid'];
    const goods = [
      ['Cotton T-Shirts x100', 'Denim Jeans x40', 'Sneakers x30'],
      ['Bluetooth Earbuds x50', 'Phone Cases x200', 'Power Banks x30'],
      ['Kitchen Utensils x150', 'LED Lamps x80'],
      ['Smart Watches x25', 'USB Cables x300'],
    ];

    let created = 0;
    for (let i = 0; i < 14; i++) {
      const sup = suppliers[i % suppliers.length];
      const items = goods[i % goods.length].map((g) => {
        const [name, q] = g.split(' x');
        const qty = Number(q) || 1;
        const unitPrice = 20 + ((i * 7 + name.length) % 60);
        return { name, qty, unitPrice };
      });
      const amountDue = items.reduce((s, it) => s + it.qty * (it.unitPrice || 0), 0);
      const shipping = 200 + (i % 5) * 150;
      const serviceFee = 50 + (i % 4) * 40;
      const total = amountDue + shipping + serviceFee;
      const paid = i % 3 === 0; // ~1/3 already paid
      const daysAgo = i;
      const createdAt = new Date(); createdAt.setDate(createdAt.getDate() - daysAgo);

      const r = this.receipts.create({
        ownerId: uid,
        receiptNumber: `KP-${createdAt.getFullYear()}-${String(existing + i + 1).padStart(6, '0')}`,
        publicToken: randomBytes(12).toString('hex'),
        customerName: customers[i % customers.length],
        customerPhone: `+255 7${String(10000000 + i * 137).slice(0, 8)}`,
        supplierName: sup.name,
        supplierPhone: sup.phone,
        items,
        itemCount: items.reduce((s, it) => s + it.qty, 0),
        amountDue, shipping, serviceFee, total,
        currency: 'CNY',
        status: paid ? 'Paid' : 'Pending',
        createdByName: 'TZ Cashier (demo)',
        paymentMethod: paid ? (METHODS[i % 4] as PayoutMethod) : '',
        transactionId: paid ? `TXN${100000 + i}` : '',
        paidByName: paid ? 'China Cashier (demo)' : '',
        paidAt: paid ? createdAt : null,
      });
      // Preserve the backdated createdAt for realistic trend charts.
      await this.receipts.save(r);
      await this.receipts.update({ id: r.id }, { createdAt });
      created++;
    }
    await this.rbac.record(uid, ctx, 'receipt.seedDemo', 'payout_receipt', null, { created });
    return { created };
  }
}
