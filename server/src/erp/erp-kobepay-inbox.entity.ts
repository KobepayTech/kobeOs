import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Registry of KobePay logistics businesses authorized to push receipts
 * into THIS ERP user's inbox. The ERP user generates an apiKey and
 * shares it with the KobePay business out-of-band; the KobePay business
 * uses it to authenticate inbound POSTs to /api/erp/kobepay-inbox.
 */
@Entity('erp_kobepay_providers')
@Index(['ownerId', 'apiKey'], { unique: true })
export class ErpKobepayProvider extends OwnedEntity {
  @Column()
  name!: string;

  /** Random bearer token. ERP owners regenerate when rotating creds. */
  @Index({ unique: true })
  @Column()
  apiKey!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: '' })
  contactEmail!: string;

  @Column({ default: '' })
  notes!: string;
}

export type ErpKobepayInboxStatus =
  | 'linked'
  | 'supplier_missing'
  | 'needs_review'
  | 'po_missing'
  | 'unallocated'
  | 'expense';

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
@Entity('erp_kobepay_inbox')
@Index(['ownerId', 'kobepayReceiptId'], { unique: true })
export class ErpKobepayInbox extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  providerId?: string | null;

  @Index()
  @Column()
  kobepayReceiptId!: string;

  @Column({ default: '' })
  kobepayBusinessName!: string;

  @Index()
  @Column()
  customerPhone!: string;

  @Column({ default: '' })
  customerName!: string;

  @Index()
  @Column()
  supplierPhone!: string;

  @Column({ default: '' })
  supplierName!: string;

  /** FK into erp_suppliers (the ERP owner's vendor list). */
  @Index()
  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  /** FK into erp_purchase_orders. */
  @Index()
  @Column('uuid', { nullable: true })
  poId?: string | null;

  @Column({ default: '' })
  poNumber!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  sentAmount!: number;

  @Column({ default: 'TZS' })
  sentCurrency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  exchangeRate!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  supplierReceivedAmount!: number;

  @Column({ default: 'CNY' })
  supplierCurrency!: string;

  @Column({ default: '' })
  supplierCity!: string;

  @Index()
  @Column({ default: 'supplier_missing' })
  allocationStatus!: ErpKobepayInboxStatus;

  @Column({ default: '' })
  reviewReason!: string;

  @Column({ default: '' })
  notes!: string;
}
