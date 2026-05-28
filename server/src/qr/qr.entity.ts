import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type QrType = 'customer' | 'supplier';

@Entity('qr_codes')
export class QrCode extends BaseEntity {
  @Index()
  @Column('uuid')
  ownerId!: string;

  /** customer | supplier */
  @Column()
  type!: QrType;

  /** The transaction / deposit reference this QR is tied to */
  @Index()
  @Column()
  reference!: string;

  /** 6-char alphanumeric short code for manual entry */
  @Index({ unique: true })
  @Column({ length: 8 })
  shortCode!: string;

  /** Full payload encoded in the QR */
  @Column({ type: 'text' })
  payload!: string;

  /** Human-readable label shown on the receipt */
  @Column({ default: '' })
  label!: string;

  /** Amount in the transaction currency */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ default: 'USD' })
  currency!: string;

  /** Extra metadata (customerName, supplierName, country, etc.) */
  @Column({ type: 'jsonb', default: '{}' })
  meta!: Record<string, unknown>;

  @Column({ default: false })
  used!: boolean;

  @Column({ nullable: true, type: 'timestamptz' })
  usedAt?: Date | null;
}
