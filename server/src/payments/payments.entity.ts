import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('wallets')
export class Wallet extends OwnedEntity {
  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'float', default: 0 })
  balance!: number;

  @Column({ default: true })
  active!: boolean;
}

@Entity('payment_transactions')
export class PaymentTransaction extends OwnedEntity {
  @Index()
  @Column('uuid')
  walletId!: string;

  @Column()
  type!: 'CREDIT' | 'DEBIT' | 'TRANSFER';

  @Column({ type: 'float' })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'PENDING' })
  status!: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

  @Column({ nullable: true, type: 'varchar' })
  counterparty?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  reference?: string | null;

  @Column({ default: '' })
  description!: string;

  @Index({ unique: true, where: '"idempotencyKey" IS NOT NULL' })
  @Column({ nullable: true, type: 'varchar' })
  idempotencyKey?: string | null;
}

@Entity('credit_loans')
export class CreditLoan extends OwnedEntity {
  @Column({ type: 'float' })
  principal!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'float', default: 0 })
  interestRate!: number;

  @Column({ default: 12 })
  termMonths!: number;

  @Column({ type: 'float', default: 0 })
  outstanding!: number;

  @Column({ default: 'ACTIVE' })
  status!: 'PENDING' | 'ACTIVE' | 'PAID' | 'DEFAULT';

  @Column({ type: 'timestamptz' })
  disbursedAt!: Date;
}
