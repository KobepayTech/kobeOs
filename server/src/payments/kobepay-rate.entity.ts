import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * House exchange rate per (from, to) currency pair. Three rate columns:
 *
 *   salesRate (public)  — what the TZ cashier quotes customers
 *   costRate (office)   — admin's internal book cost / conservative target
 *   realRate (ground)   — what Cashier China actually achieves on the day
 *
 * The spread (sales − office) is the planned margin. The variance
 * (office − real) is the surprise gain/loss: real > office means China
 * cost more than budgeted (a loss); real < office means it cost less
 * (extra profit).
 *
 * New rates are inserted (not updated) so history is preserved; only
 * the most recent active row per pair is the effective rate.
 */
@Entity('kobepay_rates')
@Index(['ownerId', 'fromCurrency', 'toCurrency', 'effectiveFrom'])
export class KobePayRate extends OwnedEntity {
  @Column()
  fromCurrency!: string;

  @Column({ default: 'TZS' })
  toCurrency!: string;

  /** Public rate: what the TZ cashier should quote customers. */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  salesRate!: number;

  /** Office rate: admin's internal book cost, conservative target. */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  costRate!: number;

  /** Real rate: what Cashier China actually achieves on the ground.
   *  Only users with the rate.setReal permission can update this. */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  realRate!: number;

  @Column({ type: 'timestamptz' })
  effectiveFrom!: Date;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: '' })
  notes!: string;
}
