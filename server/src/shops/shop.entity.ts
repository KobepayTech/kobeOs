import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * A physical shop / outlet owned by a tenant. A merchant with two
 * branches gets two Shop rows under the same ownerId, picks the active
 * one in the cashier UI, and every shop-scoped transaction (POS order,
 * expense, end-of-day cash count) carries the shopId so reports can
 * segregate revenue and expenses per branch.
 */
@Entity('shops')
@Index(['ownerId', 'name'], { unique: true })
export class Shop extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  address!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: '' })
  region!: string;

  /** Opening cash float at start of day — used as the baseline for EOD. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  openingFloat!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  /** Exactly one shop per owner can be the default — picked on first login. */
  @Column({ default: false })
  isDefault!: boolean;

  @Column({ default: true })
  active!: boolean;
}
