import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type PayoutMethod = 'Cash' | 'Bank' | 'WeChat' | 'Alipay' | 'Other';
export type PayoutReceiptStatus = 'Pending' | 'Paid' | 'Cancelled';

export interface PayoutReceiptItem {
  name: string;
  qty: number;
  unitPrice?: number;
}

/**
 * The single source of truth for a customer-funded supplier payout.
 * A public QR exposes a signed, read-only receipt while the restricted China
 * cashier workflow locks this row before changing Pending -> Paid.
 */
@Entity('kobepay_payout_receipts')
@Index(['ownerId', 'receiptNumber'], { unique: true })
@Index(['ownerId', 'status'], { unique: false })
@Index('UQ_kobepay_receipt_payout_idempotency', ['ownerId', 'payoutIdempotencyKey'], {
  unique: true,
  where: '"payoutIdempotencyKey" IS NOT NULL',
})
export class PayoutReceipt extends OwnedEntity {
  @Column()
  receiptNumber!: string;

  @Index({ unique: true })
  @Column()
  publicToken!: string;

  /** HMAC of the immutable public receipt fields. */
  @Column({ default: '' })
  verificationHash!: string;

  @Column({ default: '' })
  customerName!: string;

  @Index()
  @Column({ default: '' })
  customerPhone!: string;

  @Index()
  @Column({ default: '' })
  customerReference!: string;

  @Index()
  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  @Index()
  @Column({ default: '' })
  supplierNumber!: string;

  @Column({ default: '' })
  supplierName!: string;

  @Column({ default: '' })
  supplierPhone!: string;

  @Column({ type: 'simple-json', nullable: true })
  items?: PayoutReceiptItem[] | null;

  @Column({ default: 0 })
  itemCount!: number;

  /** Amount paid by the customer on the source side, normally TZS. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  sourceAmount!: number;

  @Column({ default: 'TZS' })
  sourceCurrency!: string;

  /** Source currency units per one payout-currency unit. */
  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  exchangeRate!: number;

  /** Supplier-side amount before shipping and service fees. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  amountDue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  shipping!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  serviceFee!: number;

  /** Exact supplier-side amount the cashier must pay. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  total!: number;

  @Column({ default: 'CNY' })
  currency!: string;

  @Column({ default: 'Pending' })
  status!: PayoutReceiptStatus;

  @Column({ default: '' })
  createdByName!: string;

  @Column({ default: '', type: 'varchar' })
  paymentMethod!: PayoutMethod | '';

  @Column({ default: '' })
  transactionId!: string;

  @Column({ nullable: true, type: 'varchar' })
  payoutIdempotencyKey!: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  paidByUserId?: string | null;

  @Column({ default: '' })
  paidByName!: string;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'text', default: '' })
  payoutNotes!: string;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ default: '' })
  cancellationReason!: string;
}
