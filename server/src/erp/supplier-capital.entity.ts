import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('erp_kobepay_links')
@Index(['kobepayBusinessId', 'customerPhone'], { unique: false })
export class ErpKobePayLink extends OwnedEntity {
  @Column()
  kobepayBusinessId!: string;

  @Column({ default: '' })
  kobepayUserId!: string;

  @Column()
  customerPhone!: string;

  @Column({ default: 'active' })
  status!: 'active' | 'disabled';

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('erp_suppliers')
@Index(['ownerId', 'phone'], { unique: false })
export class ErpSupplier extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: 'CN' })
  country!: string;

  @Column({ default: 'CNY' })
  currency!: string;

  @Column({ default: '' })
  cnyAccount!: string;

  @Column({ default: '' })
  contactPerson!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('erp_purchase_orders')
@Index(['ownerId', 'supplierId', 'status'], { unique: false })
export class ErpPurchaseOrder extends OwnedEntity {
  @Column()
  poNumber!: string;

  @Index()
  @Column('uuid')
  supplierId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalCny!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  paidCny!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  remainingCny!: number;

  @Column({ default: 'open' })
  status!: 'open' | 'partial' | 'paid' | 'cancelled';

  @Column({ type: 'date', nullable: true })
  expectedDate?: Date | null;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('erp_kobepay_supplier_receipts')
@Index(['kobepayReceiptId'], { unique: true })
@Index(['ownerId', 'allocationStatus'], { unique: false })
export class ErpKobePaySupplierReceipt extends OwnedEntity {
  @Column()
  kobepayReceiptId!: string;

  @Column()
  kobepayBusinessId!: string;

  @Column({ default: '' })
  kobepayUserId!: string;

  @Column()
  customerPhone!: string;

  @Column({ default: '' })
  supplierName!: string;

  @Column()
  supplierPhone!: string;

  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  @Column('uuid', { nullable: true })
  poId?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  sentAmount!: number;

  @Column()
  sentCurrency!: 'TZS' | 'USD';

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  exchangeRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  supplierReceivedAmount!: number;

  @Column({ default: 'CNY' })
  supplierCurrency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  feeAmount!: number;

  @Column({ default: '' })
  feeCurrency!: string;

  @Column({ default: 'supplier_payment' })
  purpose!: string;

  @Column({ default: 'unallocated' })
  allocationStatus!: 'linked' | 'supplier_missing' | 'po_missing' | 'multiple_suppliers' | 'multiple_pos' | 'advance' | 'expense' | 'freight' | 'ignored' | 'unallocated';

  @Column({ default: 'needs_po' })
  actionRequired!: 'none' | 'needs_supplier' | 'needs_po' | 'choose_supplier' | 'choose_po' | 'review';

  @Column({ type: 'timestamptz' })
  paidAt!: Date;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('erp_supplier_capital_ledger')
@Index(['ownerId', 'supplierId'], { unique: false })
export class ErpSupplierCapitalLedger extends OwnedEntity {
  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  @Column('uuid', { nullable: true })
  receiptId?: string | null;

  @Column('uuid', { nullable: true })
  poId?: string | null;

  @Column({ default: 'kobepay_receipt' })
  source!: 'kobepay_receipt' | 'manual' | 'adjustment';

  @Column({ default: 'supplier_advance' })
  entryType!: 'supplier_advance' | 'po_payment' | 'expense' | 'freight' | 'reversal';

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  sentAmount!: number;

  @Column({ default: '' })
  sentCurrency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  cnyAmount!: number;

  @Column({ default: 'CNY' })
  cnyCurrency!: string;

  @Column({ type: 'text', default: '' })
  description!: string;
}
