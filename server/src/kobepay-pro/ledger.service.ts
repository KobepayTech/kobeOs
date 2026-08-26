import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  KpAccount, KpAccountType, KpLedgerLine, KpTransaction, KpTxnKind,
} from './kobepay-pro.entity';

export interface PostLine {
  type: KpAccountType;
  refId?: string;
  debit?: number;
  credit?: number;
}

export interface PostInput {
  ownerId: string;
  kind: KpTxnKind;
  currency?: string;
  amount: number;
  schoolId?: string | null;
  studentId?: string | null;
  merchantId?: string | null;
  category?: string;
  device?: string;
  approvalRule?: string;
  description?: string;
  bankTransactionId?: string;
  metadata?: Record<string, unknown>;
}

const REF_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';
function genRef(): string {
  const bytes = randomBytes(8);
  let out = 'KP';
  for (let i = 0; i < 8; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return out;
}

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;

/**
 * The double-entry ledger. Every value movement is a balanced KpTransaction
 * with 2+ KpLedgerLine rows; account balances are stored raw as (debit − credit)
 * so the sum of all account balances is always exactly zero.
 */
@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(KpAccount) private readonly accounts: Repository<KpAccount>,
    private readonly dataSource: DataSource,
  ) {}

  /** Get or create a ledger account, locking the row for update inside a txn. */
  async ensureAccount(
    m: EntityManager, ownerId: string, type: KpAccountType, refId = '', currency = 'TZS',
  ): Promise<KpAccount> {
    let acct = await m.findOne(KpAccount, { where: { ownerId, type, refId } });
    if (!acct) {
      acct = m.create(KpAccount, { ownerId, type, refId, currency, balance: 0 });
      await m.save(acct);
    }
    return acct;
  }

  /**
   * Post a balanced transaction. `lines` must have Σdebit === Σcredit. Runs
   * inside the supplied manager (caller owns the DB transaction) so ledger and
   * any wallet overlay update commit atomically together.
   */
  async post(m: EntityManager, input: PostInput, lines: PostLine[]): Promise<KpTransaction> {
    const totalDebit = round(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
    const totalCredit = round(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
    if (lines.length < 2) throw new BadRequestException('A ledger transaction needs at least two lines');
    if (totalDebit !== totalCredit) {
      throw new BadRequestException(`Unbalanced transaction: debit ${totalDebit} ≠ credit ${totalCredit}`);
    }
    if (totalDebit <= 0) throw new BadRequestException('Transaction total must be positive');

    const txn = await m.save(m.create(KpTransaction, {
      ownerId: input.ownerId,
      reference: genRef(),
      kind: input.kind,
      status: 'POSTED',
      schoolId: input.schoolId ?? null,
      studentId: input.studentId ?? null,
      merchantId: input.merchantId ?? null,
      category: (input.category as KpTransaction['category']) ?? 'AVAILABLE',
      amount: round(input.amount),
      currency: input.currency ?? 'TZS',
      device: input.device ?? '',
      approvalRule: input.approvalRule ?? '',
      description: input.description ?? '',
      bankTransactionId: input.bankTransactionId ?? '',
      metadata: input.metadata ?? {},
    }));

    for (const line of lines) {
      const debit = round(line.debit ?? 0);
      const credit = round(line.credit ?? 0);
      if (debit === 0 && credit === 0) continue;
      const acct = await this.lockAccount(m, input.ownerId, line.type, line.refId ?? '', input.currency ?? 'TZS');
      acct.balance = round(acct.balance + debit - credit);
      await m.save(acct);
      await m.save(m.create(KpLedgerLine, {
        ownerId: input.ownerId,
        transactionId: txn.id,
        accountId: acct.id,
        debit, credit,
        balanceAfter: acct.balance,
      }));
    }

    return txn;
  }

  private async lockAccount(
    m: EntityManager, ownerId: string, type: KpAccountType, refId: string, currency: string,
  ): Promise<KpAccount> {
    await this.ensureAccount(m, ownerId, type, refId, currency);
    // Re-read with a write lock so concurrent postings serialise on this row.
    const acct = await m.createQueryBuilder(KpAccount, 'a')
      .setLock('pessimistic_write')
      .where('a.ownerId = :ownerId AND a.type = :type AND a.refId = :refId', { ownerId, type, refId })
      .getOne();
    if (!acct) throw new BadRequestException('Ledger account vanished mid-transaction');
    return acct;
  }

  /** Balance owed on a credit-normal account (STUDENT/MERCHANT/…) = −rawBalance. */
  async owed(ownerId: string, type: KpAccountType, refId = ''): Promise<number> {
    const acct = await this.accounts.findOne({ where: { ownerId, type, refId } });
    return acct ? round(-acct.balance) : 0;
  }

  /**
   * Owed amount read under a write lock inside the caller's transaction, so a
   * settlement computes the payable and posts it atomically — concurrent settle
   * calls serialize on this row and can't pay the same balance out twice.
   */
  async owedLocked(m: EntityManager, ownerId: string, type: KpAccountType, refId = ''): Promise<number> {
    const acct = await m.createQueryBuilder(KpAccount, 'a')
      .setLock('pessimistic_write')
      .where('a.ownerId = :ownerId AND a.type = :type AND a.refId = :refId', { ownerId, type, refId })
      .getOne();
    return acct ? round(-acct.balance) : 0;
  }

  /** Bank asset balance (debit-normal) = rawBalance. */
  async bankBalance(ownerId: string): Promise<number> {
    const acct = await this.accounts.findOne({ where: { ownerId, type: 'BANK', refId: '' } });
    return acct ? round(acct.balance) : 0;
  }

  /**
   * The core reconciliation: BANK must equal everything Kobepay owes out.
   *   bank = students + merchants + suppliers + escrow + fees
   * `balanced` is the invariant Σ(all account balances) === 0.
   */
  async reconcile(ownerId: string): Promise<{
    bank: number; students: number; merchants: number; suppliers: number;
    escrow: number; fees: number; balanced: boolean; drift: number;
    solvent: boolean; overdrawn: Array<{ type: KpAccountType; refId: string; owed: number }>;
  }> {
    const all = await this.accounts.find({ where: { ownerId } });
    const sumOwed = (t: KpAccountType) =>
      round(all.filter((a) => a.type === t).reduce((s, a) => s + -a.balance, 0));
    const bank = round(all.filter((a) => a.type === 'BANK').reduce((s, a) => s + a.balance, 0));
    const drift = round(all.reduce((s, a) => s + a.balance, 0));
    // Double-entry always nets to 0, so `drift` never catches an overspend.
    // Solvency = no liability account is negative (owed < 0 means we paid out
    // more than was funded) and bank is non-negative.
    const LIABILITY: KpAccountType[] = ['STUDENT', 'MERCHANT', 'SUPPLIER', 'ESCROW', 'FEES'];
    const overdrawn = all
      .filter((a) => LIABILITY.includes(a.type) && -a.balance < -0.0001)
      .map((a) => ({ type: a.type, refId: a.refId, owed: round(-a.balance) }));
    return {
      bank,
      students: sumOwed('STUDENT'),
      merchants: sumOwed('MERCHANT'),
      suppliers: sumOwed('SUPPLIER'),
      escrow: sumOwed('ESCROW'),
      fees: sumOwed('FEES'),
      balanced: Math.abs(drift) < 0.0001,
      drift,
      solvent: overdrawn.length === 0 && bank >= -0.0001,
      overdrawn,
    };
  }
}
