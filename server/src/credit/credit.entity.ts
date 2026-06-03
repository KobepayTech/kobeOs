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
