import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * House exchange rate per (from, to) currency pair. salesRate is what
 * the TZ cashier should quote customers; costRate is what Cashier China
 * actually pays at. The spread between them is the owner's expected
 * profit margin. New rates are inserted (not updated) so the history
 * is preserved; only the most recent active row per pair is the
 * effective rate.
 */
@Entity('kobepay_rates')
@Index(['ownerId', 'fromCurrency', 'toCurrency', 'effectiveFrom'])
export class KobePayRate extends OwnedEntity {
  @Column()
  fromCurrency!: string;

  @Column({ default: 'TZS' })
  toCurrency!: string;

  /** Rate the TZ cashier should quote customers: 1 from = salesRate * to. */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  salesRate!: number;

  /** Rate Cashier China actually pays at: 1 from = costRate * to. */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  costRate!: number;

  @Column({ type: 'timestamptz' })
  effectiveFrom!: Date;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: '' })
  notes!: string;
}
