import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('wallets')
export class Wallet extends OwnedEntity {
  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance!: number;

  @Column({ default: true })
  active!: boolean;
}

// Per-owner uniqueness on idempotency keys: two different KobeOS
// accounts may reuse the same key without colliding; the same key from
// the same owner returns the original transaction. The DB index lives
// at the entity level so it can include both columns.
@Entity('payment_transactions')
@Index('payment_transactions_owner_idempotency_uk',
       ['ownerId', 'idempotencyKey'],
       { unique: true, where: '"idempotencyKey" IS NOT NULL' })
export class PaymentTransaction extends OwnedEntity {
  @Index()
  @Column('uuid')
  walletId!: string;

  @Column()
  type!: 'CREDIT' | 'DEBIT' | 'TRANSFER';

  @Column({ type: 'decimal', precision: 18, scale: 4 })
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

  @Column({ nullable: true, type: 'varchar' })
  idempotencyKey?: string | null;
}

@Entity('credit_loans')
export class CreditLoan extends OwnedEntity {
  @Column({ type: 'decimal', precision: 18, scale: 4 })
  principal!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  interestRate!: number;

  @Column({ default: 12 })
  termMonths!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  outstanding!: number;

  @Column({ default: 'ACTIVE' })
  status!: 'PENDING' | 'ACTIVE' | 'PAID' | 'DEFAULT';

  @Column({ type: 'timestamptz' })
  disbursedAt!: Date;
}
