import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * A supplier-payout receipt — the single source of truth for the China
 * Cashier workflow. Created upstream (by the Tanzania cashier when a
 * customer pays for goods), it captures everything the China cashier
 * needs to pay the supplier: who the supplier is, the itemised goods,
 * the amount due plus shipping and service fee, and the running total.
 *
 * The China cashier never types an amount. They scan the receipt QR (or
 * enter the receipt number), the row is loaded verbatim, they pick a
 * payment method and hit Pay — flipping the status Pending → Paid and
 * stamping who/when/how. This removes manual supplier selection and
 * eliminates payout amount-entry mistakes.
 */
export type PayoutMethod = 'Cash' | 'Bank' | 'WeChat' | 'Alipay' | 'Other';
export type PayoutReceiptStatus = 'Pending' | 'Paid';

export interface PayoutReceiptItem {
  name: string;
  qty: number;
  unitPrice?: number;
}

@Entity('kobepay_payout_receipts')
@Index(['ownerId', 'receiptNumber'], { unique: true })
@Index(['ownerId', 'status'], { unique: false })
export class PayoutReceipt extends OwnedEntity {
  /** Human-facing receipt number, e.g. KP-2026-000254. Unique per owner. */
  @Column()
  receiptNumber!: string;

  /** Unguessable token embedded in the QR so the public receipt page can
   *  be opened without leaking the sequential receipt number space. */
  @Index({ unique: true })
  @Column()
  publicToken!: string;

  /* ── Parties ── */
  @Column({ default: '' })
  customerName!: string;

  @Column({ default: '' })
  customerPhone!: string;

  @Index()
  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  @Column({ default: '' })
  supplierName!: string;

  @Column({ default: '' })
  supplierPhone!: string;

  /* ── Goods ── */
  @Column({ type: 'simple-json', nullable: true })
  items?: PayoutReceiptItem[] | null;

  @Column({ default: 0 })
  itemCount!: number;

  /* ── Money (supplier-side currency, defaults CNY) ── */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  amountDue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  shipping!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  serviceFee!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  total!: number;

  @Column({ default: 'CNY' })
  currency!: string;

  /* ── Lifecycle ── */
  @Column({ default: 'Pending' })
  status!: PayoutReceiptStatus;

  /** Who raised the receipt (Tanzania cashier / owner). */
  @Column({ default: '' })
  createdByName!: string;

  /* ── Payout record (filled when the China cashier pays) ── */
  @Column({ default: '', type: 'varchar' })
  paymentMethod!: PayoutMethod | '';

  @Column({ default: '' })
  transactionId!: string;

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
}
