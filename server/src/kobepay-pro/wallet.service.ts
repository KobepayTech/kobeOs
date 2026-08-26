import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  KpBucket, KpReservedHold, KpStudent, KpTransaction, KpWallet, SpendCategory,
} from './kobepay-pro.entity';
import { LedgerService, PostLine } from './ledger.service';

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
 * The spendable overlay on top of the ledger. Reserving money moves it to the
 * ESCROW ledger account, so the invariants are:
 *   available + savings + Σ buckets            === ledger owed(STUDENT)
 *   Σ active reserved holds (per student)       === that student's share of ESCROW
 * The student's displayed total (available + savings + buckets + reserved) is
 * therefore owed(STUDENT) + their reserved. Every method preserves this.
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

  /**
   * Load the wallet with a write lock so concurrent spend/reserve/deposit on the
   * SAME student serialize — the balance guard is a read-then-write, which
   * without this lock double-spends under concurrency. Must be called inside a
   * transaction.
   */
  private async lockWallet(m: EntityManager, ownerId: string, studentId: string, currency = 'TZS'): Promise<KpWallet> {
    await this.ensureWallet(m, ownerId, studentId, currency); // create row if missing
    const w = await m.createQueryBuilder(KpWallet, 'w')
      .setLock('pessimistic_write')
      .where('w.ownerId = :ownerId AND w.studentId = :studentId', { ownerId, studentId })
      .getOne();
    if (!w) throw new BadRequestException('Wallet not found');
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
    return this.dataSource.transaction((m) => this.applyDepositIn(m, ownerId, studentId, amount, opts));
  }

  /** Credit a deposit inside the caller's transaction (so the credit and the
   *  deposit-row status flip commit together — no double-credit on retry). */
  async applyDepositIn(
    m: EntityManager, ownerId: string, studentId: string, amount: number,
    opts: { bankTransactionId?: string; schoolId?: string; description?: string; source?: string } = {},
  ): Promise<KpTransaction> {
    if (amount <= 0) throw new BadRequestException('Deposit amount must be positive');
    const wallet = await this.lockWallet(m, ownerId, studentId);
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
  }

  /** Reclassify money between pools (Available ⇄ category bucket ⇄ Savings). No ledger movement. */
  async allocate(
    ownerId: string, studentId: string, from: SpendCategory, to: SpendCategory, amount: number,
  ): Promise<WalletView> {
    if (amount <= 0) throw new BadRequestException('Allocation must be positive');
    if (from === to) throw new BadRequestException('Choose two different pools');
    await this.dataSource.transaction(async (m) => {
      const wallet = await this.lockWallet(m, ownerId, studentId);
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
    return this.dataSource.transaction((m) => this.reserveIn(m, ownerId, studentId, amount, purpose, groupId));
  }

  /** Reserve inside the caller's transaction (used by group join). */
  async reserveIn(
    m: EntityManager, ownerId: string, studentId: string, amount: number, purpose: string, groupId?: string,
  ): Promise<KpReservedHold> {
    if (amount <= 0) throw new BadRequestException('Reserve amount must be positive');
    const wallet = await this.lockWallet(m, ownerId, studentId);
    if (wallet.available < amount) throw new BadRequestException('Insufficient available balance to reserve');
    wallet.available = round(wallet.available - amount);
    await m.save(wallet);
    const hold = await m.save(m.create(KpReservedHold, {
      ownerId, studentId, amount, purpose, groupId: groupId ?? null, status: 'RESERVED',
    }));
    // Move the money into escrow at the ledger level: Dr STUDENT / Cr ESCROW.
    // It is still the student's until captured, but held apart from spendable.
    await this.ledger.post(m, {
      ownerId, kind: 'RESERVE', amount, currency: wallet.currency,
      studentId, category: 'GROUP', description: purpose,
      metadata: { groupId: groupId ?? null, holdId: hold.id },
    }, [
      { type: 'STUDENT', refId: studentId, debit: amount },
      { type: 'ESCROW', credit: amount },
    ]);
    return hold;
  }

  /** Release a hold back to Available (e.g. a group failed to reach minimum). */
  async release(ownerId: string, holdId: string): Promise<WalletView> {
    const studentId = await this.dataSource.transaction(async (m) => {
      return this.releaseHold(m, ownerId, holdId);
    });
    return this.view(ownerId, studentId);
  }

  /** Release a hold inside the caller's transaction (Dr ESCROW / Cr STUDENT). */
  async releaseHold(m: EntityManager, ownerId: string, holdId: string): Promise<string> {
    const hold = await m.findOne(KpReservedHold, { where: { ownerId, id: holdId } });
    if (!hold) throw new NotFoundException('Reserved hold not found');
    if (hold.status !== 'RESERVED') throw new BadRequestException('Hold is not active');
    const wallet = await this.lockWallet(m, ownerId, hold.studentId);
    hold.status = 'RELEASED';
    await m.save(hold);
    wallet.available = round(wallet.available + hold.amount);
    await m.save(wallet);
    await this.ledger.post(m, {
      ownerId, kind: 'RELEASE', amount: hold.amount, currency: wallet.currency,
      studentId: hold.studentId, category: 'GROUP', description: `Release ${hold.purpose}`,
      metadata: { holdId },
    }, [
      { type: 'ESCROW', debit: hold.amount },
      { type: 'STUDENT', refId: hold.studentId, credit: hold.amount },
    ]);
    return hold.studentId;
  }

  /**
   * Capture an escrowed hold to a supplier when a group completes, inside the
   * caller's transaction. The supplier gets `supplierShare`; any margin (the
   * group-vs-supplier price difference) is recognised as Kobepay fees:
   *   Dr ESCROW amount / Cr SUPPLIER supplierShare / Cr FEES margin.
   */
  async captureHold(
    m: EntityManager, ownerId: string, holdId: string, supplierId: string, supplierShare: number,
  ): Promise<void> {
    const hold = await m.findOne(KpReservedHold, { where: { ownerId, id: holdId } });
    if (!hold) throw new NotFoundException('Reserved hold not found');
    if (hold.status !== 'RESERVED') throw new BadRequestException('Hold is not active');
    const supShare = round(Math.max(0, supplierShare));
    // The escrowed amount must cover the supplier cost — a group priced below
    // cost would otherwise silently underpay the supplier.
    if (supShare > hold.amount + 0.0001) {
      throw new BadRequestException('Reserved amount does not cover the supplier cost for this order');
    }
    const margin = round(hold.amount - supShare);
    hold.status = 'CAPTURED';
    await m.save(hold);
    const lines: PostLine[] = [
      { type: 'ESCROW', debit: hold.amount },
      { type: 'SUPPLIER', refId: supplierId, credit: supShare },
    ];
    if (margin > 0) lines.push({ type: 'FEES', credit: margin });
    await this.ledger.post(m, {
      ownerId, kind: 'CAPTURE', amount: hold.amount, currency: 'TZS',
      studentId: hold.studentId, category: 'GROUP',
      description: `Capture ${hold.purpose} → supplier`,
      metadata: { holdId, supplierId, supplierShare: supShare, margin },
    }, lines);
  }

  /**
   * Deduct `amount` from a student for a payment, inside the caller's DB
   * transaction. Spends the matching category bucket first, then Available.
   * Returns the pool breakdown. Throws if insufficient across allowed pools.
   */
  async spendFrom(
    m: EntityManager, ownerId: string, studentId: string, category: SpendCategory, amount: number,
  ): Promise<{ fromBucket: number; fromAvailable: number }> {
    const wallet = await this.lockWallet(m, ownerId, studentId);
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
