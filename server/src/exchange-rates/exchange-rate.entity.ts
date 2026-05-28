import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type ExchangeRateStatus = 'pending' | 'funded' | 'cancelled';

/**
 * Records the rate quoted to a customer vs the actual rate on payout day.
 * The difference is the platform's profit or loss on that transaction.
 */
@Entity('exchange_rates')
export class ExchangeRate extends BaseEntity {
  /** User (cashier/admin) who recorded this entry */
  @Index()
  @Column('uuid')
  recordedBy!: string;

  /** Linked transaction reference (e.g. TXN-20240115-001-S01) */
  @Index()
  @Column({ default: '' })
  txnReference!: string;

  /** ISO date the transaction was created */
  @Column({ type: 'date' })
  txnDate!: string;

  /** ISO date the payout was funded (actual rate applies on this date) */
  @Column({ nullable: true, type: 'date' })
  fundedDate?: string | null;

  /** Currency being sent (CNY, TZS, INR, etc.) */
  @Column({ length: 8 })
  currency!: string;

  /** Amount in USD the customer deposited */
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amountUsd!: number;

  /** Rate quoted to customer (units of foreign currency per 1 USD) */
  @Column({ type: 'decimal', precision: 18, scale: 6 })
  customerRate!: number;

  /** Actual rate on payout day */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  actualRate!: number;

  /** Amount customer was told they'd receive (amountUsd * customerRate) */
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  customerReceives!: number;

  /** Amount actually paid out (amountUsd * actualRate) — set on funding */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  actualPaid!: number;

  /**
   * Profit/loss in foreign currency units.
   * Positive = platform profit (actual > customer rate).
   * Negative = platform loss (actual < customer rate).
   * Only meaningful when status = 'funded'.
   */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  profitLoss!: number;

  @Index()
  @Column({ default: 'pending' })
  status!: ExchangeRateStatus;

  @Column({ default: '' })
  notes!: string;
}
