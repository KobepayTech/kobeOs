import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/* ============ accounting ============ */
@Entity('erp_accounts')
export class ErpAccount extends OwnedEntity {
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: 'Asset' })
  type!: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

  @Column({ type: 'float', default: 0 })
  balance!: number;
}

@Entity('erp_transactions')
export class ErpTransaction extends OwnedEntity {
  @Column({ nullable: true, type: 'varchar' })
  date?: string | null;

  @Column({ default: '' })
  account!: string;

  @Column({ type: 'float', default: 0 })
  debit!: number;

  @Column({ type: 'float', default: 0 })
  credit!: number;

  @Column({ default: '' })
  description!: string;
}

/* ============ loyalty ============ */
@Entity('erp_loyalty_customers')
export class LoyaltyCustomer extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: 0 })
  points!: number;

  @Column({ nullable: true, type: 'varchar' })
  joinDate?: string | null;

  @Column({ default: 0 })
  visits!: number;
}

@Entity('erp_loyalty_rewards')
export class LoyaltyReward extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: 0 })
  points!: number;

  @Column({ default: '' })
  image!: string;

  @Column({ default: 0 })
  stock!: number;
}

@Entity('erp_loyalty_points')
export class LoyaltyPointsEntry extends OwnedEntity {
  @Column({ default: '' })
  customer!: string;

  @Column({ default: 'Earned' })
  type!: 'Earned' | 'Redeemed' | 'Bonus';

  @Column({ default: 0 })
  points!: number;

  @Column({ default: '' })
  description!: string;

  @Column({ nullable: true, type: 'varchar' })
  date?: string | null;
}

/* ============ sourcing ============ */
@Entity('erp_suppliers')
export class Supplier extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  contact!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: '' })
  country!: string;

  @Column({ type: 'float', default: 0 })
  rating!: number;

  @Column({ default: 'Active' })
  status!: 'Active' | 'Inactive';
}

export interface PoItem {
  name: string;
  qty: number;
  price: number;
}

@Entity('erp_purchase_orders')
export class PurchaseOrder extends OwnedEntity {
  @Column()
  poNumber!: string;

  @Column({ default: '' })
  supplier!: string;

  @Column({ type: 'float', default: 0 })
  total!: number;

  @Column({ default: 'Pending' })
  status!: 'Delivered' | 'In Transit' | 'Pending' | 'Cancelled';

  @Column({ nullable: true, type: 'varchar' })
  date?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  deliveryDate?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  items?: PoItem[] | null;
}
