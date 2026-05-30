import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ErpAccount, ErpTransaction } from './erp.entity';
import { PosOrder, PosOrderItem } from '../pos/pos.entity';

export interface AccountCode {
  code: string;
  name: string;
  type: ErpAccount['type'];
}

/** Standard 7-account chart bootstrapped per owner on first POS sale. */
export const STANDARD_ACCOUNTS: AccountCode[] = [
  { code: '1000', name: 'Cash',                  type: 'Asset' },
  { code: '1100', name: 'Accounts Receivable',   type: 'Asset' },
  { code: '1200', name: 'Inventory',             type: 'Asset' },
  { code: '2000', name: 'Sales Tax Payable',     type: 'Liability' },
  { code: '4000', name: 'Sales Revenue',         type: 'Revenue' },
  { code: '4100', name: 'Sales Discounts',       type: 'Revenue' },
  { code: '5000', name: 'Cost of Goods Sold',    type: 'Expense' },
];

interface JournalLine {
  code: string;
  debit?: number;
  credit?: number;
  description: string;
}

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(ErpAccount) private readonly accounts: Repository<ErpAccount>,
    @InjectRepository(ErpTransaction) private readonly transactions: Repository<ErpTransaction>,
  ) {}

  /**
   * Post a balanced journal entry for a POS sale inside the order's tx.
   * Cash sales hit Cash; BNPL sales hit Accounts Receivable. Returns the
   * inserted ErpTransaction rows so the caller can include them in the
   * sale response.
   */
  async postPosSaleInTransaction(
    tx: EntityManager,
    uid: string,
    order: PosOrder,
    items: PosOrderItem[],
    opts: { isBnpl: boolean },
  ): Promise<ErpTransaction[]> {
    await this.ensureChartOfAccounts(tx, uid);

    const subtotal = Number(order.subtotal);
    const tax = Number(order.taxAmount);
    const discount = Number(order.discountAmount);
    const total = Number(order.total);
    const date = (order.createdAt ?? new Date()).toISOString().slice(0, 10);
    const ref = `POS ${order.orderNumber}`;

    const lines: JournalLine[] = [];
    if (opts.isBnpl) {
      lines.push({ code: '1100', debit: total, description: `${ref} (BNPL receivable)` });
    } else {
      lines.push({ code: '1000', debit: total, description: `${ref} (${order.paymentMethod})` });
    }
    if (discount > 0) {
      lines.push({ code: '4100', debit: discount, description: `${ref} discount` });
    }
    // Revenue line is gross of discount so debits balance:
    //   DR Cash/AR (total) + DR Discounts (discount) = CR Revenue (subtotal) + CR Tax (tax)
    //   total + discount = subtotal + tax  ⇔  total = subtotal - discount + tax ✓
    const revenue = parseFloat((subtotal).toFixed(4));
    if (revenue > 0) {
      lines.push({ code: '4000', credit: revenue, description: `${ref} revenue (${items.length} item${items.length === 1 ? '' : 's'})` });
    }
    if (tax > 0) {
      lines.push({ code: '2000', credit: tax, description: `${ref} VAT` });
    }

    // Sanity check the entry balances; refuse to post if not (better to
    // surface a server error than corrupt the books).
    const totalDebits = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const totalCredits = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(`Unbalanced journal entry for ${ref}: DR=${totalDebits} CR=${totalCredits}`);
    }

    return this.postLines(tx, uid, date, lines);
  }

  /**
   * Post a single BNPL receivable payment: DR Cash, CR Accounts
   * Receivable for the amount paid.
   */
  async postReceivablePaymentInTransaction(
    tx: EntityManager,
    uid: string,
    amount: number,
    reference: string,
  ): Promise<ErpTransaction[]> {
    await this.ensureChartOfAccounts(tx, uid);
    const date = new Date().toISOString().slice(0, 10);
    return this.postLines(tx, uid, date, [
      { code: '1000', debit: amount,  description: `${reference} payment` },
      { code: '1100', credit: amount, description: `${reference} payment` },
    ]);
  }

  list(uid: string) {
    return this.transactions.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' } });
  }

  listAccounts(uid: string) {
    return this.accounts.find({ where: { ownerId: uid }, order: { code: 'ASC' } });
  }

  private async ensureChartOfAccounts(tx: EntityManager, uid: string) {
    const repo = tx.getRepository(ErpAccount);
    const have = await repo.find({ where: { ownerId: uid } });
    const haveCodes = new Set(have.map((a) => a.code));
    const toCreate = STANDARD_ACCOUNTS.filter((a) => !haveCodes.has(a.code));
    if (toCreate.length === 0) return;
    await repo.save(
      toCreate.map((a) => repo.create({ ownerId: uid, code: a.code, name: a.name, type: a.type, balance: 0 })),
    );
  }

  private async postLines(
    tx: EntityManager,
    uid: string,
    date: string,
    lines: JournalLine[],
  ): Promise<ErpTransaction[]> {
    const txnRepo = tx.getRepository(ErpTransaction);
    const accountRepo = tx.getRepository(ErpAccount);
    const inserted: ErpTransaction[] = [];

    for (const line of lines) {
      const account = await accountRepo.findOne({ where: { ownerId: uid, code: line.code } });
      if (!account) throw new Error(`Missing account ${line.code}; chart of accounts not bootstrapped`);
      const debit = line.debit ?? 0;
      const credit = line.credit ?? 0;
      // Debit increases Asset/Expense, decreases Liability/Equity/Revenue.
      const delta = ['Asset', 'Expense'].includes(account.type) ? debit - credit : credit - debit;
      account.balance = parseFloat((Number(account.balance) + delta).toFixed(4));
      await accountRepo.save(account);

      inserted.push(
        await txnRepo.save(
          txnRepo.create({
            ownerId: uid,
            date,
            account: `${account.code} ${account.name}`,
            debit,
            credit,
            description: line.description,
          }),
        ),
      );
    }
    return inserted;
  }
}
