import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type RiskGrade = 'A+' | 'A' | 'B' | 'C' | 'D';
export type ReceivableStatus = 'OUTSTANDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WRITTEN_OFF';

@Entity('credit_profiles')
@Index(['ownerId', 'customerPhone'], { unique: true })
export class CreditProfile extends OwnedEntity {
  @Column()
  customerPhone!: string;

  @Column({ default: '' })
  customerName!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  creditLimit!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  outstanding!: number;

  @Column({ default: 'C' })
  riskGrade!: RiskGrade;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: true })
  active!: boolean;
}

@Entity('credit_receivables')
export class CreditReceivable extends OwnedEntity {
  @Index()
  @Column('uuid')
  profileId!: string;

  @Index()
  @Column('uuid', { nullable: true })
  orderId?: string | null;

  @Column()
  customerPhone!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  paid!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 1 })
  installmentMonths!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  monthlyAmount!: number;

  @Column({ type: 'timestamptz' })
  dueDate!: Date;

  @Column({ default: 'OUTSTANDING' })
  status!: ReceivableStatus;
}

export type InstalmentStatus = 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE';

/**
 * Per-instalment row for a BNPL receivable. The receivable splits its
 * amount into N rows here at creation time so the customer-facing receipt
 * can show "$40 by 14 Jun / $40 by 28 Jun / $40 by 12 Jul" verbatim and
 * the cashier's payment UI can mark them off in order as money comes in.
 */
@Entity('credit_instalments')
@Index(['ownerId', 'receivableId', 'sequence'], { unique: true })
@Index(['ownerId', 'dueDate'])
export class CreditInstalment extends OwnedEntity {
  @Index()
  @Column('uuid')
  receivableId!: string;

  /** 1-based position within the receivable (1 of 3, 2 of 3, …). */
  @Column()
  sequence!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amountDue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amountPaid!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'timestamptz' })
  dueDate!: Date;

  @Column({ default: 'DUE' })
  status!: InstalmentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;
}
