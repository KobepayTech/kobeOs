import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PayoutReceipt, PayoutMethod } from './payout-receipt.entity';
import { CreateReceiptDto, PayReceiptDto } from './dto/payout-receipt.dto';
import { KobePayRbacService, AuditContext } from './kobepay-rbac.service';

const METHODS: PayoutMethod[] = ['Cash', 'Bank', 'WeChat', 'Alipay', 'Other'];
const num = (value: unknown) => Number(value) || 0;
const digits = (value: string) => value.replace(/\D/g, '');
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const monthKey = (date: Date) => date.toISOString().slice(0, 7);

function maskPhone(phone: string): string {
  const clean = digits(phone);
  if (clean.length < 6) return phone ? '••••' : '';
  return `${clean.slice(0, 3)}••••${clean.slice(-3)}`;
}

@Injectable()
export class KobePayReceiptsService {
  private readonly receiptSecret: string;

  constructor(
    @InjectRepository(PayoutReceipt) private readonly receipts: Repository<PayoutReceipt>,
    private readonly rbac: KobePayRbacService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.receiptSecret = config.get<string>('KOBEPAY_RECEIPT_SECRET')
      || config.get<string>('JWT_SECRET')
      || 'kobeos-local-receipt-secret';
  }

  private signaturePayload(receipt: PayoutReceipt): string {
    return JSON.stringify({
      receiptNumber: receipt.receiptNumber,
      publicToken: receipt.publicToken,
      customerName: receipt.customerName,
      customerPhone: digits(receipt.customerPhone),
      supplierNumber: receipt.supplierNumber,
      supplierName: receipt.supplierName,
      sourceAmount: num(receipt.sourceAmount),
      sourceCurrency: receipt.sourceCurrency,
      exchangeRate: num(receipt.exchangeRate),
      amountDue: num(receipt.amountDue),
      shipping: num(receipt.shipping),
      serviceFee: num(receipt.serviceFee),
      total: num(receipt.total),
      currency: receipt.currency,
    });
  }

  private sign(receipt: PayoutReceipt): string {
    return createHmac('sha256', this.receiptSecret)
      .update(this.signaturePayload(receipt))
      .digest('hex');
  }

  private verify(receipt: PayoutReceipt): boolean {
    if (!receipt.verificationHash) return false;
    const expected = Buffer.from(this.sign(receipt), 'hex');
    const actual = Buffer.from(receipt.verificationHash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async list(uid: string, opts: { status?: 'Pending' | 'Paid' | 'Cancelled'; q?: string } = {}) {
    const qb = this.receipts.createQueryBuilder('r')
      .where('r.ownerId = :uid', { uid })
      .orderBy('r.createdAt', 'DESC')
      .take(500);
    if (opts.status) qb.andWhere('r.status = :status', { status: opts.status });
    if (opts.q?.trim()) {
      const q = `%${opts.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(r.receiptNumber) LIKE :q OR LOWER(r.supplierName) LIKE :q OR LOWER(r.supplierNumber) LIKE :q OR LOWER(r.customerName) LIKE :q OR LOWER(r.customerPhone) LIKE :q)',
        { q },
      );
    }
    return qb.getMany();
  }

  async getByNumber(uid: string, receiptNumber: string) {
    const receipt = await this.receipts.findOne({
      where: { ownerId: uid, receiptNumber: receiptNumber.trim().toUpperCase() },
    });
    if (!receipt) throw new NotFoundException(`No receipt "${receiptNumber}"`);
    return receipt;
  }

  async getByTokenOwned(uid: string, token: string) {
    const receipt = await this.receipts.findOne({ where: { ownerId: uid, publicToken: token } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  /** China cashier customer lookup by mobile number. */
  async getByCustomerPhone(uid: string, phone: string) {
    const requested = digits(phone);
    if (requested.length < 7) throw new BadRequestException('Enter a valid customer mobile number');
    const rows = await this.receipts.find({
      where: { ownerId: uid },
      order: { createdAt: 'DESC' },
      take: 5000,
    });
    const matching = rows.filter((row) => {
      const stored = digits(row.customerPhone);
      return stored === requested || stored.endsWith(requested) || requested.endsWith(stored);
    });
    if (!matching.length) throw new NotFoundException('No customer or receipts found for that mobile number');
    const first = matching[0];
    const pending = matching.filter((row) => row.status === 'Pending');
    const paid = matching.filter((row) => row.status === 'Paid');
    return {
      customer: {
        name: first.customerName,
        phone: first.customerPhone,
        reference: first.customerReference,
      },
      totals: {
        pendingCount: pending.length,
        pendingAmount: pending.reduce((sum, row) => sum + num(row.total), 0),
        paidCount: paid.length,
        paidAmount: paid.reduce((sum, row) => sum + num(row.total), 0),
        currency: first.currency,
      },
      receipts: matching,
    };
  }

  async getPublic(token: string) {
    const receipt = await this.receipts.findOne({ where: { publicToken: token } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    const verified = this.verify(receipt);
    return {
      receiptNumber: receipt.receiptNumber,
      verification: {
        verified,
        fingerprint: receipt.verificationHash ? receipt.verificationHash.slice(0, 16).toUpperCase() : '',
      },
      customerName: receipt.customerName,
      customerPhone: maskPhone(receipt.customerPhone),
      customerReference: receipt.customerReference,
      supplierName: receipt.supplierName,
      supplierNumber: receipt.supplierNumber,
      supplierPhone: maskPhone(receipt.supplierPhone),
      items: receipt.items ?? [],
      itemCount: receipt.itemCount,
      sourceAmount: num(receipt.sourceAmount),
      sourceCurrency: receipt.sourceCurrency,
      exchangeRate: num(receipt.exchangeRate),
      amountDue: num(receipt.amountDue),
      shipping: num(receipt.shipping),
      serviceFee: num(receipt.serviceFee),
      amountToReceive: num(receipt.total),
      total: num(receipt.total),
      currency: receipt.currency,
      status: receipt.status,
      createdAt: receipt.createdAt,
      createdByName: receipt.createdByName || null,
      paymentMethod: receipt.paymentMethod || null,
      transactionId: receipt.transactionId || null,
      paidByName: receipt.paidByName || null,
      paidAt: receipt.paidAt || null,
      cancelledAt: receipt.cancelledAt || null,
      cancellationReason: receipt.cancellationReason || null,
    };
  }

  private async nextReceiptNumber(uid: string, offset = 0): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.receipts.count({ where: { ownerId: uid } });
    return `KP-${year}-${String(count + 1 + offset).padStart(6, '0')}`;
  }

  async create(uid: string, ctx: AuditContext, dto: CreateReceiptDto) {
    const amountDue = num(dto.amountDue);
    const shipping = num(dto.shipping);
    const serviceFee = num(dto.serviceFee);
    const total = amountDue + shipping + serviceFee;
    const items = dto.items ?? [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const receiptNumber = await this.nextReceiptNumber(uid, attempt);
      try {
        let saved = await this.receipts.save(this.receipts.create({
          ownerId: uid,
          receiptNumber,
          publicToken: randomBytes(18).toString('hex'),
          customerName: dto.customerName?.trim() ?? '',
          customerPhone: dto.customerPhone?.trim() ?? '',
          customerReference: dto.customerReference?.trim() || `CUS-${randomBytes(4).toString('hex').toUpperCase()}`,
          supplierId: dto.supplierId ?? null,
          supplierNumber: dto.supplierNumber?.trim() || `SUP-${randomBytes(4).toString('hex').toUpperCase()}`,
          supplierName: dto.supplierName.trim(),
          supplierPhone: dto.supplierPhone?.trim() ?? '',
          items,
          itemCount: items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
          sourceAmount: num(dto.sourceAmount) || total,
          sourceCurrency: dto.sourceCurrency || 'TZS',
          exchangeRate: num(dto.exchangeRate),
          amountDue,
          shipping,
          serviceFee,
          total,
          currency: dto.currency ?? 'CNY',
          status: 'Pending',
          createdByName: dto.createdByName ?? ctx.user?.name ?? '',
          payoutIdempotencyKey: null,
        }));
        saved.verificationHash = this.sign(saved);
        saved = await this.receipts.save(saved);
        await this.rbac.record(uid, ctx, 'receipt.create', 'payout_receipt', saved.id, {
          receiptNumber,
          supplierNumber: saved.supplierNumber,
          supplierName: saved.supplierName,
          total,
          currency: saved.currency,
        });
        return saved;
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    throw new BadRequestException('Could not allocate a receipt number');
  }

  /**
   * Lock the receipt row before payout. The request amount is ignored: the
   * cashier always pays the immutable receipt total. Repeating the same
   * idempotency key returns the original success; a different second payout is
   * rejected.
   */
  async pay(uid: string, ctx: AuditContext, id: string, dto: PayReceiptDto) {
    this.rbac.ensure(ctx.user ?? null, 'payout.markPaid');
    if (!METHODS.includes(dto.method)) throw new BadRequestException('Invalid payment method');

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutReceipt);
      const receipt = await repo.createQueryBuilder('receipt')
        .setLock('pessimistic_write')
        .where('receipt.ownerId = :uid AND receipt.id = :id', { uid, id })
        .getOne();
      if (!receipt) throw new NotFoundException('Receipt not found');
      if (receipt.status === 'Cancelled') throw new BadRequestException(`Receipt ${receipt.receiptNumber} is cancelled`);
      if (receipt.status === 'Paid') {
        if (receipt.payoutIdempotencyKey === dto.idempotencyKey) return receipt;
        throw new ConflictException(`Receipt ${receipt.receiptNumber} is already paid`);
      }

      const keyOwner = await repo.findOne({
        where: { ownerId: uid, payoutIdempotencyKey: dto.idempotencyKey },
      });
      if (keyOwner && keyOwner.id !== receipt.id) {
        throw new ConflictException('This payout request was already used for another receipt');
      }

      receipt.status = 'Paid';
      receipt.paymentMethod = dto.method;
      receipt.transactionId = dto.transactionId ?? '';
      receipt.payoutIdempotencyKey = dto.idempotencyKey;
      receipt.paidByUserId = ctx.user?.id ?? null;
      receipt.paidByName = ctx.user?.name ?? 'owner';
      receipt.paidAt = new Date();
      receipt.payoutNotes = dto.notes ?? '';
      return repo.save(receipt);
    });

    await this.rbac.record(uid, ctx, 'payout.markPaid', 'payout_receipt', saved.id, {
      receiptNumber: saved.receiptNumber,
      method: dto.method,
      total: num(saved.total),
      currency: saved.currency,
      idempotencyKey: dto.idempotencyKey,
    });
    return saved;
  }

  async dashboard(uid: string) {
    const rows = await this.receipts.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 5000 });
    const pending = rows.filter((row) => row.status === 'Pending');
    const paid = rows.filter((row) => row.status === 'Paid');
    const today = dayKey(new Date());
    const paidTodayRows = paid.filter((row) => row.paidAt && dayKey(new Date(row.paidAt)) === today);
    const byMethod = METHODS.map((method) => ({
      method,
      amount: paid.filter((row) => row.paymentMethod === method).reduce((sum, row) => sum + num(row.total), 0),
      count: paid.filter((row) => row.paymentMethod === method).length,
    })).filter((row) => row.count > 0);

    const dailyTrend: { date: string; amount: number }[] = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = dayKey(date);
      dailyTrend.push({
        date: key.slice(5),
        amount: paid.filter((row) => row.paidAt && dayKey(new Date(row.paidAt)) === key).reduce((sum, row) => sum + num(row.total), 0),
      });
    }
    const monthlyTrend: { month: string; amount: number }[] = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);
      const key = monthKey(date);
      monthlyTrend.push({
        month: key,
        amount: paid.filter((row) => row.paidAt && monthKey(new Date(row.paidAt)) === key).reduce((sum, row) => sum + num(row.total), 0),
      });
    }
    const currency = rows[0]?.currency ?? 'CNY';
    return {
      currency,
      cards: {
        pendingAmount: pending.reduce((sum, row) => sum + num(row.total), 0),
        pendingCount: pending.length,
        paidToday: paidTodayRows.reduce((sum, row) => sum + num(row.total), 0),
        paidTodayCount: paidTodayRows.length,
        totalPaid: paid.reduce((sum, row) => sum + num(row.total), 0),
        totalPaidCount: paid.length,
      },
      byMethod,
      pendingVsPaid: [
        { name: 'Pending', value: pending.reduce((sum, row) => sum + num(row.total), 0), count: pending.length },
        { name: 'Paid', value: paid.reduce((sum, row) => sum + num(row.total), 0), count: paid.length },
      ],
      dailyTrend,
      monthlyTrend,
    };
  }

  async analytics(uid: string, filters: { from?: string; to?: string; method?: string; cashier?: string; supplier?: string } = {}) {
    const rows = await this.receipts.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 10000 });
    const fromTime = filters.from ? new Date(filters.from).getTime() : -Infinity;
    const toTime = filters.to ? new Date(filters.to).getTime() + 86_400_000 : Infinity;
    const filtered = rows.filter((row) => {
      const time = row.paidAt ? new Date(row.paidAt).getTime() : new Date(row.createdAt).getTime();
      if (time < fromTime || time > toTime) return false;
      if (filters.method && row.paymentMethod !== filters.method) return false;
      if (filters.cashier && row.paidByName !== filters.cashier) return false;
      if (filters.supplier && !row.supplierName.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
      return true;
    });
    const paid = filtered.filter((row) => row.status === 'Paid');
    const pending = filtered.filter((row) => row.status === 'Pending');
    const durations = paid
      .filter((row) => row.paidAt)
      .map((row) => (new Date(row.paidAt!).getTime() - new Date(row.createdAt).getTime()) / 3_600_000)
      .filter((hours) => hours >= 0);
    const averageHours = durations.length ? durations.reduce((sum, hours) => sum + hours, 0) / durations.length : 0;
    const group = (keyFn: (row: PayoutReceipt) => string) => {
      const groups = new Map<string, { amount: number; count: number }>();
      paid.forEach((row) => {
        const key = keyFn(row);
        const current = groups.get(key) ?? { amount: 0, count: 0 };
        current.amount += num(row.total);
        current.count += 1;
        groups.set(key, current);
      });
      return [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.amount - a.amount);
    };
    return {
      currency: rows[0]?.currency ?? 'CNY',
      totals: {
        pendingAmount: pending.reduce((sum, row) => sum + num(row.total), 0),
        pendingCount: pending.length,
        paidAmount: paid.reduce((sum, row) => sum + num(row.total), 0),
        paidCount: paid.length,
        avgPayoutHours: Math.round(averageHours * 10) / 10,
      },
      byCashier: group((row) => row.paidByName || 'owner'),
      byMethod: group((row) => row.paymentMethod || 'Other'),
      byDay: group((row) => row.paidAt ? dayKey(new Date(row.paidAt)) : dayKey(new Date(row.createdAt))).sort((a, b) => a.key.localeCompare(b.key)),
      byMonth: group((row) => row.paidAt ? monthKey(new Date(row.paidAt)) : monthKey(new Date(row.createdAt))).sort((a, b) => a.key.localeCompare(b.key)),
      rows: filtered.slice(0, 1000),
    };
  }

  async seedDemo(uid: string, ctx: AuditContext) {
    const existing = await this.receipts.count({ where: { ownerId: uid } });
    if (existing > 0) return { created: 0, note: 'Receipts already exist — skipped.' };
    const suppliers = [
      { number: 'SUP-CN-001', name: 'Shanghai Fashion Ltd', phone: '+86 138 0011 2200' },
      { number: 'SUP-CN-002', name: 'Guangzhou Electronics Co', phone: '+86 139 0022 3311' },
      { number: 'SUP-CN-003', name: 'Yiwu Trading House', phone: '+86 137 0033 4422' },
      { number: 'SUP-CN-004', name: 'Shenzhen Gadgets Ltd', phone: '+86 136 0044 5533' },
    ];
    const customers = [
      { name: 'Stephen', phone: '+255 713 000 001' },
      { name: 'Amina Hassan', phone: '+255 713 000 002' },
      { name: 'John Mwangi', phone: '+255 713 000 003' },
      { name: 'Grace Namuli', phone: '+255 713 000 004' },
    ];
    let created = 0;
    for (let index = 0; index < 14; index += 1) {
      const supplier = suppliers[index % suppliers.length];
      const customer = customers[index % customers.length];
      const items = [{ name: index % 2 ? 'Bluetooth Earbuds' : 'Cotton T-Shirts', qty: 10 + index, unitPrice: 25 + index }];
      const amountDue = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
      const receipt = this.receipts.create({
        ownerId: uid,
        receiptNumber: `KP-${new Date().getFullYear()}-${String(index + 1).padStart(6, '0')}`,
        publicToken: randomBytes(18).toString('hex'),
        customerName: customer.name,
        customerPhone: customer.phone,
        customerReference: `CUS-TZ-${String((index % customers.length) + 1).padStart(3, '0')}`,
        supplierNumber: supplier.number,
        supplierName: supplier.name,
        supplierPhone: supplier.phone,
        items,
        itemCount: items.reduce((sum, item) => sum + item.qty, 0),
        sourceAmount: amountDue * 350,
        sourceCurrency: 'TZS',
        exchangeRate: 350,
        amountDue,
        shipping: 200,
        serviceFee: 50,
        total: amountDue + 250,
        currency: 'CNY',
        status: 'Pending',
        createdByName: 'TZ Cashier (demo)',
        payoutIdempotencyKey: null,
      });
      receipt.verificationHash = this.sign(receipt);
      await this.receipts.save(receipt);
      created += 1;
    }
    await this.rbac.record(uid, ctx, 'receipt.seedDemo', 'payout_receipt', null, { created });
    return { created };
  }
}
