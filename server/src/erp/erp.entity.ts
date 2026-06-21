import { Column, Entity, Index } from 'typeorm';
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

  /** Cumulative amount paid against this PO, computed by walking the
   *  SupplierPayment rows linked back to this PO. The "Pay PO" prompt
   *  shows `total - paidAmount` as the outstanding balance. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  paidAmount!: number;

  @Column({ default: 'Pending' })
  status!: 'Delivered' | 'In Transit' | 'Pending' | 'Cancelled';

  @Column({ nullable: true, type: 'varchar' })
  date?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  deliveryDate?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  items?: PoItem[] | null;
}

/**
 * Records a payment made to a supplier — typically a KobePay payout
 * that the operator has reconciled against either an open PO ("this
 * pays down PO-104") or a new goods delivery ("I just paid for 30
 * bags of cement, no PO existed yet"). Created from the
 * reconciliation modal that pops up after a KobePay payout when the
 * supplier's phone matches an ERP Supplier row.
 *
 * One SupplierPayment may link back to a KobePay payout (payoutId)
 * so the accounting side has a single source of truth and the
 * operator can audit "where did that TZS X go" from either app.
 */
@Entity('erp_supplier_payments')
export class SupplierPayment extends OwnedEntity {
  @Index()
  @Column('uuid')
  supplierId!: string;

  @Column()
  supplierName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  /** Reconciliation choice from the prompt:
   *    PO_PAYMENT — paying down a specific open PO
   *    NEW_GOODS  — just bought goods directly, no PO existed
   *    GENERAL    — supplier deposit / no goods reference */
  @Column({ length: 16, default: 'GENERAL' })
  kind!: 'PO_PAYMENT' | 'NEW_GOODS' | 'GENERAL';

  /** Optional FK to PurchaseOrder when kind=PO_PAYMENT. Walked when
   *  recomputing PO.paidAmount. */
  @Index()
  @Column('uuid', { nullable: true })
  purchaseOrderId?: string | null;

  /** Optional FK back to the KobePay payout that triggered this
   *  reconciliation. Null when the operator records a supplier
   *  payment directly without going through KobePay (cash, bank
   *  transfer, etc). */
  @Index()
  @Column('uuid', { nullable: true })
  payoutId?: string | null;

  /** For NEW_GOODS: snapshot of the items the operator says they
   *  bought, since no PO exists. Free-form so hardware shops can
   *  log "30 bags of cement" and clothing shops can log
   *  "50 black caps". */
  @Column({ type: 'simple-json', nullable: true })
  itemsSnapshot?: Array<{ description: string; quantity: number; unitPrice?: number }> | null;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;
}
