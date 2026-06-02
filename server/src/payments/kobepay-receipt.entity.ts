import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type ReceiptAllocationStatus =
  | 'linked'
  | 'supplier_missing'
  | 'needs_review'      // multiple suppliers under this owner share the phone
  | 'po_missing'        // supplier matched, no open PO
  | 'unallocated'       // user explicitly deferred
  | 'expense';          // user marked it as an expense, no supplier

/**
 * KobePay receipt landed in the ERP inbox awaiting a safe scoped match
 * to one of THIS owner's suppliers. Phone numbers are NEVER matched
 * globally — every lookup runs WHERE ownerId = :uid first, so two
 * different ERP customers can both have Guangzhou Shoes Ltd at the
 * same +86 number without ever cross-contaminating.
 *
 * (ownerId, kobepayReceiptId) is unique so re-importing the same
 * receipt twice is idempotent.
 */
@Entity('kobepay_supplier_receipts')
@Index(['ownerId', 'kobepayReceiptId'], { unique: true })
export class KobepaySupplierReceipt extends OwnedEntity {
  /** External receipt id from the KobePay logistics business. */
  @Index()
  @Column()
  kobepayReceiptId!: string;

  /** Which logistics business sent this receipt (optional — supports
   *  many KobePay providers feeding the same ERP user later). */
  @Column({ default: '' })
  kobepayBusinessId!: string;

  /** End customer phone — used to identify the ERP user account when
   *  receipts are dispatched into a multi-tenant inbox. */
  @Index()
  @Column()
  customerPhone!: string;

  @Column({ default: '' })
  customerName!: string;

  /** Supplier phone as it appeared on the receipt — matched ONLY within
   *  the receiving owner's suppliers. */
  @Index()
  @Column()
  supplierPhone!: string;

  @Column({ default: '' })
  supplierName!: string;

  /** Resolved supplier (nullable until matched or created). FK to
   *  kobepay_suppliers — same-ownerId rows only. */
  @Index()
  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  /** Resolved PO (nullable). Free-text PO number is captured separately
   *  so unmatched receipts can still reference what the customer typed. */
  @Index()
  @Column('uuid', { nullable: true })
  poId?: string | null;

  @Column({ default: '' })
  poNumber!: string;

  /** What customer sent (TZS or USD cash). */
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  sentAmount!: number;

  @Column({ default: 'TZS' })
  sentCurrency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  exchangeRate!: number;

  /** What supplier in China received. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  supplierReceivedAmount!: number;

  @Column({ default: 'CNY' })
  supplierCurrency!: string;

  @Column({ default: '' })
  supplierCity!: string;

  @Index()
  @Column({ default: 'supplier_missing' })
  allocationStatus!: ReceiptAllocationStatus;

  /** Why this row landed in its current status — e.g. "2 suppliers
   *  share phone +86..." or "no open PO for supplier X". */
  @Column({ default: '' })
  reviewReason!: string;

  @Column({ default: '' })
  notes!: string;
}
