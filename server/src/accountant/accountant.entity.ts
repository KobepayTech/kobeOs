import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('accountant_financial_transactions')
@Index(['ownerId', 'sourceType', 'sourceId'], { unique: true })
@Index(['ownerId', 'status', 'detectedAt'])
export class FinancialTransaction extends OwnedEntity {
  @Column() sourceType!: string;
  @Column() sourceId!: string;
  @Column({ default: 'IN' }) direction!: 'IN' | 'OUT' | 'TRANSFER';
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) counterparty!: string;
  @Column({ default: '' }) reference!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'timestamptz' }) detectedAt!: Date;
  @Column({ default: 'NEEDS_INFO' }) status!: 'NEEDS_INFO' | 'CLASSIFIED' | 'IGNORED' | 'REVERSED';
  @Column({ type: 'jsonb', default: {} }) raw!: Record<string, unknown>;
}

@Entity('accountant_sms_transactions')
@Index(['ownerId', 'inboundPaymentId'], { unique: true })
export class SmsTransaction extends OwnedEntity {
  @Column('uuid') inboundPaymentId!: string;
  @Column('uuid') financialTransactionId!: string;
  @Column() transactionId!: string;
  @Column() provider!: string;
  @Column({ type: 'text' }) rawMessage!: string;
}

@Entity('accountant_questions')
@Index(['ownerId', 'status', 'escalateAt'])
export class AccountingQuestion extends OwnedEntity {
  @Column('uuid') financialTransactionId!: string;
  @Column({ type: 'text' }) question!: string;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
  @Column({ type: 'timestamptz' }) escalateAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) answeredAt?: Date | null;
  @Column({ type: 'text', default: '' }) answer!: string;
  @Column({ default: 'CHAT' }) answeredVia!: 'CHAT' | 'CALL' | 'MANUAL';
}

@Entity('accountant_conversations')
@Index(['questionId', 'createdAt'])
export class AccountingConversation extends OwnedEntity {
  @Column('uuid') questionId!: string;
  @Column({ default: 'CHAT' }) channel!: 'CHAT' | 'CALL' | 'SYSTEM';
  @Column({ default: 'OUTBOUND' }) direction!: 'OUTBOUND' | 'INBOUND';
  @Column({ type: 'text' }) content!: string;
  @Column({ type: 'jsonb', default: {} }) evidence!: Record<string, unknown>;
}

@Entity('accountant_calls')
@Index(['questionId'])
@Index(['callbackToken'], { unique: true })
export class AccountingCall extends OwnedEntity {
  @Column('uuid') questionId!: string;
  @Column() provider!: string;
  @Column({ default: '' }) providerCallId!: string;
  @Column() callbackToken!: string;
  @Column() phone!: string;
  @Column({ default: 'QUEUED' }) status!: 'QUEUED' | 'RINGING' | 'ANSWERED' | 'FAILED' | 'COMPLETED';
  @Column({ type: 'text', default: '' }) transcript!: string;
  @Column({ type: 'timestamptz', nullable: true }) startedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt?: Date | null;
  @Column({ type: 'jsonb', default: {} }) providerPayload!: Record<string, unknown>;
}

@Entity('accountant_classifications')
@Index(['ownerId', 'financialTransactionId'])
export class AccountingClassification extends OwnedEntity {
  @Column('uuid') financialTransactionId!: string;
  @Column() classificationType!: 'INCOME' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'TRANSFER' | 'IGNORE';
  @Column() category!: string;
  @Column({ default: '' }) accountCode!: string;
  @Column({ type: 'float', default: 0 }) confidence!: number;
  @Column({ type: 'text', default: '' }) rationale!: string;
  @Column({ type: 'text', default: '' }) ownerAnswer!: string;
  @Column({ type: 'jsonb', default: {} }) evidence!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: [] }) journalTransactionIds!: string[];
  @Column({ type: 'uuid', nullable: true }) correctsClassificationId?: string | null;
}

@Entity('accountant_daily_closes')
@Index(['ownerId', 'closeDate'], { unique: true })
export class DailyClose extends OwnedEntity {
  @Column({ type: 'date' }) closeDate!: string;
  @Column({ default: 'PRELIMINARY' }) status!: 'PRELIMINARY' | 'CLOSED' | 'REOPENED';
  @Column({ type: 'int', default: 0 }) transactionCount!: number;
  @Column({ type: 'int', default: 0 }) unresolvedCount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) moneyIn!: number;
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) moneyOut!: number;
  @Column({ type: 'jsonb', default: {} }) statements!: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) completedAt?: Date | null;
}

export const ACCOUNTANT_ENTITIES = [FinancialTransaction, SmsTransaction, AccountingQuestion, AccountingConversation, AccountingCall, AccountingClassification, DailyClose] as const;
