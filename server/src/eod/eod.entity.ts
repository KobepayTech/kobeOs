import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salaries'
  | 'transport'
  | 'restock'
  | 'supplies'
  | 'marketing'
  | 'maintenance'
  | 'food'
  | 'tax'
  | 'kobepay_payout'
  | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent:            'Rent',
  utilities:       'Utilities (electricity, water, internet)',
  salaries:        'Salaries & wages',
  transport:       'Transport & fuel',
  restock:         'Stock purchase / restock',
  supplies:        'Supplies & packaging',
  marketing:       'Marketing & ads',
  maintenance:     'Maintenance & repairs',
  food:            'Food & refreshments',
  tax:             'Tax',
  kobepay_payout:  'KobePay payout',
  other:           'Other',
};

/**
 * Money taken OUT of the till during a trading day. Recorded as the
 * cashier spends — when reconciling at end of day the expense total is
 * subtracted from the expected cash so the count balances. shopId is
 * required so two branches don't share an expense ledger.
 */
@Entity('shop_expenses')
@Index(['ownerId', 'shopId', 'createdAt'])
export class ShopExpense extends OwnedEntity {
  @Index()
  @Column('uuid')
  shopId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'other' })
  category!: ExpenseCategory;

  @Column({ default: '' })
  description!: string;

  /** Receipt photo URL (optional) — uploaded via /api/media/upload. */
  @Column({ nullable: true, type: 'varchar' })
  receiptUrl?: string | null;

  /** Paid via — cash from till, mobile money, bank transfer, etc. */
  @Column({ default: 'cash' })
  paidVia!: 'cash' | 'mobile_money' | 'bank' | 'card' | 'kobepay';

  @Column({ nullable: true, type: 'uuid' })
  recordedBy?: string | null;
}

/**
 * End-of-day cash reconciliation snapshot. Each row represents one
 * close-out: cashier counts physical cash in the till, system computes
 * what should be there (opening float + cash sales − cash expenses), and
 * the variance gets recorded for the owner to review.
 */
@Entity('shop_cash_counts')
@Index(['ownerId', 'shopId', 'closedAt'])
export class ShopCashCount extends OwnedEntity {
  @Index()
  @Column('uuid')
  shopId!: string;

  /** Date the trading day represents — YYYY-MM-DD. */
  @Column({ type: 'date' })
  tradingDate!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  openingFloat!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  cashSales!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  cashExpenses!: number;

  /** Computed at close: openingFloat + cashSales - cashExpenses. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  expectedCash!: number;

  /** What the cashier physically counted. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  countedCash!: number;

  /** countedCash - expectedCash. Negative = short, positive = over. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  variance!: number;

  @Column({ default: '' })
  notes!: string;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'timestamptz' })
  closedAt!: Date;

  @Column({ nullable: true, type: 'uuid' })
  closedBy?: string | null;
}
