import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ErpAccount, ErpTransaction } from './erp.entity';
import { PosOrder, PosOrderItem } from '../pos/pos.entity';
import { PaymentDeposit, PaymentPayout } from '../payments/kobepay.entity';
import { ErpKobepayInbox } from './erp-kobepay-inbox.entity';

export interface AccountCode {
  code: string;
  name: string;
  type: ErpAccount['type'];
}

/**
 * Standard chart bootstrapped per owner on first journal post. Covers
 * POS, BNPL, KobePay (both the logistics-business books AND the ERP
 * customer side that receives receipts), and the fee buckets KobePay
 * uses for variance accounting.
 */
export const STANDARD_ACCOUNTS: AccountCode[] = [
  { code: '1000', name: 'Cash',                       type: 'Asset' },
  { code: '1010', name: 'China Cash',                 type: 'Asset' },
  { code: '1100', name: 'Accounts Receivable',        type: 'Asset' },
  { code: '1200', name: 'Inventory',                  type: 'Asset' },
  { code: '1300', name: 'Inventory in Transit',       type: 'Asset' },
  { code: '2000', name: 'Sales Tax Payable',          type: 'Liability' },
  { code: '2100', name: 'Customer Deposit Liability', type: 'Liability' },
  { code: '4000', name: 'Sales Revenue',              type: 'Revenue' },
  { code: '4100', name: 'Sales Discounts',            type: 'Revenue' },
  { code: '4200', name: 'Exchange Profit/Loss',       type: 'Revenue' },
  { code: '5000', name: 'Cost of Goods Sold',         type: 'Expense' },
  { code: '5100', name: 'Bank Charges',               type: 'Expense' },
  { code: '5200', name: 'Mobile Money Charges',       type: 'Expense' },
  { code: '5300', name: 'Agent Commission',           type: 'Expense' },
  { code: '5400', name: 'Transaction Fees',           type: 'Expense' },
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
   * KobePay's books: deposit confirmed.
   *   DR Cash (or China Cash if cashCurrency is the supplier-side
   *     currency — rare, but supported)
   *   CR Customer Deposit Liability
   *
   * The cash entry uses collectedTzs as the universal TZS-denominated
   * book value so the GL stays consistent regardless of cash currency.
   */
  async postKobepayDepositConfirmedInTransaction(
    tx: EntityManager,
    uid: string,
    deposit: PaymentDeposit,
  ): Promise<ErpTransaction[]> {
    await this.ensureChartOfAccounts(tx, uid);
    const collected = Number(deposit.collectedTzs);
    if (collected <= 0) return [];
    const date = (deposit.createdAt ?? new Date()).toISOString().slice(0, 10);
    const ref = `KobePay deposit ${deposit.id.slice(0, 8)} (${deposit.customerName || deposit.phone})`;
    return this.postLines(tx, uid, date, [
      { code: '1000', debit: collected,  description: `${ref} cash in` },
      { code: '2100', credit: collected, description: `${ref} liability to deliver ${deposit.targetCurrency}` },
    ]);
  }

  /**
   * KobePay's books: payout PAID. Closes out the deposit's customer
   * liability, recognises the real cost in China, books exchange P&L
   * for the variance, and posts all fees as expenses against Cash.
   *
   *   DR Customer Deposit Liability   (collected TZS for this deposit)
   *   CR China Cash                   (real cost in TZS = qty × actualRate)
   *   CR Exchange Profit/Loss          (variance, signed)
   *   DR (fees) / CR Cash              (one line per non-zero fee)
   */
  async postKobepayPayoutPaidInTransaction(
    tx: EntityManager,
    uid: string,
    payout: PaymentPayout,
    deposit: PaymentDeposit | null,
  ): Promise<ErpTransaction[]> {
    await this.ensureChartOfAccounts(tx, uid);
    const date = new Date().toISOString().slice(0, 10);
    const ref = `KobePay payout ${payout.id.slice(0, 8)} to ${payout.supplierName}`;
    const lines: JournalLine[] = [];

    const realCost = Number(payout.actualCostTzs);
    const collected = deposit ? Number(deposit.collectedTzs) : 0;

    if (collected > 0) {
      lines.push({ code: '2100', debit: collected, description: `${ref} close out deposit liability` });
    }
    if (realCost > 0) {
      lines.push({ code: '1010', credit: realCost, description: `${ref} China cash out (real)` });
    }

    // Exchange P&L = collected − realCost − fees, but we only book the
    // pre-fee variance here; fees are their own offsetting lines below.
    const exchangeVariance = collected - realCost;
    if (collected > 0 && Math.abs(exchangeVariance) > 0.01) {
      if (exchangeVariance > 0) {
        // Real cost cheaper than booked liability → profit (credit revenue).
        lines.push({ code: '4200', credit: exchangeVariance, description: `${ref} exchange profit` });
      } else {
        // Real cost above booked liability → loss (debit revenue contra).
        lines.push({ code: '4200', debit: -exchangeVariance, description: `${ref} exchange loss` });
      }
    }

    const fees: Array<[string, number, string]> = [
      ['5100', Number(payout.bankCharges),       'bank charges'],
      ['5200', Number(payout.mobileMoneyCharges),'mobile money charges'],
      ['5300', Number(payout.agentCommission),   'agent commission'],
      ['5400', Number(payout.transactionFees),   'transaction fees'],
    ];
    for (const [code, amount, label] of fees) {
      if (amount > 0) {
        lines.push({ code,     debit: amount,  description: `${ref} ${label}` });
        lines.push({ code: '1000', credit: amount, description: `${ref} cash out (${label})` });
      }
    }

    return this.postLines(tx, uid, date, lines);
  }

  /**
   * ERP customer's books: KobePay receipt arrived and was linked to a
   * supplier (either auto-matched at ingest or resolved later). Books
   * the customer's outflow:
   *
   *   DR Inventory in Transit         (sentAmount converted to TZS)
   *   CR Cash                          (the money already left her hands
   *                                     when she paid KobePay's cashier)
   *
   * If the receipt's sentCurrency is already TZS, no conversion needed;
   * otherwise we use the sentAmount × exchangeRate from the receipt
   * (KobePay tells us what rate it used).
   */
  async postKobepayReceiptLinkedInTransaction(
    tx: EntityManager,
    uid: string,
    receipt: ErpKobepayInbox,
  ): Promise<ErpTransaction[]> {
    await this.ensureChartOfAccounts(tx, uid);
    const date = (receipt.createdAt ?? new Date()).toISOString().slice(0, 10);
    const sent = Number(receipt.sentAmount);
    const rate = Number(receipt.exchangeRate);
    const tzs = receipt.sentCurrency === 'TZS'
      ? sent
      : rate > 0 ? parseFloat((sent * rate).toFixed(4)) : sent;
    if (tzs <= 0) return [];
    const ref = `KobePay receipt ${receipt.kobepayReceiptId} (${receipt.supplierName})`;
    return this.postLines(tx, uid, date, [
      { code: '1300', debit: tzs,  description: `${ref} goods in transit` },
      { code: '1000', credit: tzs, description: `${ref} cash paid to KobePay` },
    ]);
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
