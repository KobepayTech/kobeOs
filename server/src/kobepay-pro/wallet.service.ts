import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  KpBucket, KpReservedHold, KpStudent, KpTransaction, KpWallet, SpendCategory,
} from './kobepay-pro.entity';
import { LedgerService } from './ledger.service';

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;

export interface WalletView {
  studentId: string;
  currency: string;
  available: number;
  savings: number;
  buckets: Array<{ category: SpendCategory; balance: number }>;
  reserved: Array<{ id: string; purpose: string; amount: number; groupId: string | null }>;
  reservedTotal: number;
  total: number;
  spentToday: number;
}

/**
 * The spendable overlay on top of the ledger. A student's ledger balance is the
 * total Kobepay owes them; this service splits that total across Available,
 * Restricted category buckets, Reserved holds and Savings. The invariant
 *   available + savings + Σ buckets + Σ reserved === ledger owed(STUDENT)
 * is preserved by every method here (deposits move the ledger too; internal
 * reclassification/reserve keep the total constant).
 */
@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(KpWallet) private readonly wallets: Repository<KpWallet>,
    @InjectRepository(KpBucket) private readonly buckets: Repository<KpBucket>,
    @InjectRepository(KpReservedHold) private readonly holds: Repository<KpReservedHold>,
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async ensureWallet(m: EntityManager, ownerId: string, studentId: string, currency = 'TZS'): Promise<KpWallet> {
    let w = await m.findOne(KpWallet, { where: { ownerId, studentId } });
    if (!w) {
      w = m.create(KpWallet, { ownerId, studentId, available: 0, savings: 0, currency, spentToday: 0 });
      await m.save(w);
    }
    return w;
  }

  async view(ownerId: string, studentId: string): Promise<WalletView> {
    const student = await this.students.findOne({ where: { ownerId, id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    const wallet = await this.wallets.findOne({ where: { ownerId, studentId } });
    const buckets = await this.buckets.find({ where: { ownerId, studentId } });
    const holds = await this.holds.find({ where: { ownerId, studentId, status: 'RESERVED' } });
    const reservedTotal = round(holds.reduce((s, h) => s + h.amount, 0));
    const available = wallet?.available ?? 0;
    const savings = wallet?.savings ?? 0;
    const bucketTotal = round(buckets.reduce((s, b) => s + b.balance, 0));
    return {
      studentId,
      currency: wallet?.currency ?? 'TZS',
      available,
      savings,
      buckets: buckets.map((b) => ({ category: b.category, balance: b.balance })),
      reserved: holds.map((h) => ({ id: h.id, purpose: h.purpose, amount: h.amount, groupId: h.groupId ?? null })),
      reservedTotal,
      total: round(available + savings + bucketTotal + reservedTotal),
      spentToday: this.todaySpend(wallet),
    };
  }

  private todaySpend(w: KpWallet | null | undefined): number {
    if (!w) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return w.spentDay === today ? w.available >= 0 ? w.spentToday : 0 : 0;
  }

  /**
   * Credit a matched bank deposit into a student's wallet. Posts the ledger
   * (Dr BANK / Cr STUDENT) and grows the Available pool, atomically.
   */
  async applyDeposit(
    ownerId: string, studentId: string, amount: number,
    opts: { bankTransactionId?: string; schoolId?: string; description?: string; source?: string } = {},
  ): Promise<KpTransaction> {
    if (amount <= 0) throw new BadRequestException('Deposit amount must be positive');
    return this.dataSource.transaction(async (m) => {
      const wallet = await this.ensureWallet(m, ownerId, studentId);
      const txn = await this.ledger.post(m, {
        ownerId, kind: 'DEPOSIT', amount, currency: wallet.currency,
        schoolId: opts.schoolId ?? null, studentId, category: 'AVAILABLE',
        description: opts.description ?? 'Parent deposit',
        bankTransactionId: opts.bankTransactionId ?? '',
        metadata: { source: opts.source ?? 'MANUAL' },
      }, [
        { type: 'BANK', debit: amount },
        { type: 'STUDENT', refId: studentId, credit: amount },
      ]);
      wallet.available = round(wallet.available + amount);
      await m.save(wallet);
      return txn;
    });
  }

  /** Reclassify money between pools (Available ⇄ category bucket ⇄ Savings). No ledger movement. */
  async allocate(
    ownerId: string, studentId: string, from: SpendCategory, to: SpendCategory, amount: number,
  ): Promise<WalletView> {
    if (amount <= 0) throw new BadRequestException('Allocation must be positive');
    if (from === to) throw new BadRequestException('Choose two different pools');
    await this.dataSource.transaction(async (m) => {
      const wallet = await this.ensureWallet(m, ownerId, studentId);
      await this.movePool(m, ownerId, studentId, wallet, from, -amount);
      await this.movePool(m, ownerId, studentId, wallet, to, amount);
      await m.save(wallet);
      await m.save(m.create(KpTransaction, {
        ownerId, reference: 'ALLOC', kind: 'ADJUSTMENT', status: 'POSTED', studentId,
        category: to, amount, currency: wallet.currency,
        description: `Reallocate ${from} → ${to}`, metadata: { from, to },
      }));
    });
    return this.view(ownerId, studentId);
  }

  /** Reserve Available money for a group order (escrow-style hold). */
  async reserve(
    ownerId: string, studentId: string, amount: number, purpose: string, groupId?: string,
  ): Promise<KpReservedHold> {
    if (amount <= 0) throw new BadRequestException('Reserve amount must be positive');
    return this.dataSource.transaction(async (m) => {
      const wallet = await this.ensureWallet(m, ownerId, studentId);
      if (wallet.available < amount) throw new BadRequestException('Insufficient available balance to reserve');
      wallet.available = round(wallet.available - amount);
      await m.save(wallet);
      const hold = await m.save(m.create(KpReservedHold, {
        ownerId, studentId, amount, purpose, groupId: groupId ?? null, status: 'RESERVED',
      }));
      await m.save(m.create(KpTransaction, {
        ownerId, reference: 'RSV', kind: 'RESERVE', status: 'POSTED', studentId,
        category: 'GROUP', amount, currency: wallet.currency,
        description: purpose, metadata: { groupId: groupId ?? null, holdId: hold.id },
      }));
      return hold;
    });
  }

  /** Release a hold back to Available (e.g. a group order failed to reach minimum). */
  async release(ownerId: string, holdId: string): Promise<WalletView> {
    const studentId = await this.dataSource.transaction(async (m) => {
      const hold = await m.findOne(KpReservedHold, { where: { ownerId, id: holdId } });
      if (!hold) throw new NotFoundException('Reserved hold not found');
      if (hold.status !== 'RESERVED') throw new BadRequestException('Hold is not active');
      const wallet = await this.ensureWallet(m, ownerId, hold.studentId);
      hold.status = 'RELEASED';
      await m.save(hold);
      wallet.available = round(wallet.available + hold.amount);
      await m.save(wallet);
      await m.save(m.create(KpTransaction, {
        ownerId, reference: 'REL', kind: 'RELEASE', status: 'POSTED', studentId: hold.studentId,
        category: 'GROUP', amount: hold.amount, currency: wallet.currency,
        description: `Release ${hold.purpose}`, metadata: { holdId },
      }));
      return hold.studentId;
    });
    return this.view(ownerId, studentId);
  }

  /**
   * Deduct `amount` from a student for a payment, inside the caller's DB
   * transaction. Spends the matching category bucket first, then Available.
   * Returns the pool breakdown. Throws if insufficient across allowed pools.
   */
  async spendFrom(
    m: EntityManager, ownerId: string, studentId: string, category: SpendCategory, amount: number,
  ): Promise<{ fromBucket: number; fromAvailable: number }> {
    const wallet = await this.ensureWallet(m, ownerId, studentId);
    let remaining = round(amount);
    let fromBucket = 0;

    if (category !== 'AVAILABLE' && category !== 'SAVINGS') {
      const bucket = await m.findOne(KpBucket, { where: { ownerId, studentId, category } });
      if (bucket && bucket.balance > 0) {
        fromBucket = Math.min(bucket.balance, remaining);
        bucket.balance = round(bucket.balance - fromBucket);
        await m.save(bucket);
        remaining = round(remaining - fromBucket);
      }
    }

    if (remaining > 0) {
      if (wallet.available < remaining) {
        throw new BadRequestException('Insufficient spendable balance');
      }
      wallet.available = round(wallet.available - remaining);
    }

    // Daily-spend counter (reset on day change).
    const today = new Date().toISOString().slice(0, 10);
    if (wallet.spentDay !== today) { wallet.spentDay = today; wallet.spentToday = 0; }
    wallet.spentToday = round(wallet.spentToday + amount);
    await m.save(wallet);

    return { fromBucket, fromAvailable: round(remaining) };
  }

  private async movePool(
    m: EntityManager, ownerId: string, studentId: string, wallet: KpWallet, pool: SpendCategory, delta: number,
  ) {
    if (pool === 'AVAILABLE') {
      wallet.available = round(wallet.available + delta);
      if (wallet.available < -0.0001) throw new BadRequestException('Insufficient Available balance');
      return;
    }
    if (pool === 'SAVINGS') {
      wallet.savings = round(wallet.savings + delta);
      if (wallet.savings < -0.0001) throw new BadRequestException('Insufficient Savings balance');
      return;
    }
    let bucket = await m.findOne(KpBucket, { where: { ownerId, studentId, category: pool } });
    if (!bucket) bucket = m.create(KpBucket, { ownerId, studentId, category: pool, balance: 0 });
    bucket.balance = round(bucket.balance + delta);
    if (bucket.balance < -0.0001) throw new BadRequestException(`Insufficient ${pool} balance`);
    await m.save(bucket);
  }
}
