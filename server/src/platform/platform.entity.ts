import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('platform_domain_events')
@Index(['eventName', 'occurredAt'])
@Index(['ownerId', 'occurredAt'])
@Index('UQ_platform_event_key', ['ownerId', 'eventName', 'idempotencyKey'], { unique: true, where: '"idempotencyKey" IS NOT NULL' })
export class PlatformDomainEvent extends BaseEntity {
  @Column({ type: 'uuid', nullable: true }) ownerId?: string | null;
  @Column() eventName!: string;
  @Column() aggregateType!: string;
  @Column({ type: 'uuid', nullable: true }) aggregateId?: string | null;
  @Column({ type: 'jsonb', default: {} }) payload!: Record<string, unknown>;
  @Column({ type: 'timestamptz' }) occurredAt!: Date;
  @Column({ default: 'RECORDED' }) status!: 'RECORDED' | 'PUBLISHED' | 'FAILED';
  @Column({ type: 'int', default: 0 }) attempts!: number;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt?: Date | null;
  @Column({ default: 1 }) schemaVersion!: number;
  @Column({ type: 'uuid', nullable: true }) correlationId?: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) idempotencyKey?: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) fingerprint?: string | null;
  @Column({ type: 'timestamptz', nullable: true }) nextAttemptAt?: Date | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) lastError?: string | null;
}

@Entity('platform_business_signals')
@Index(['ownerId', 'createdAt'])
@Index(['sourceEventId'], { unique: true })
export class PlatformBusinessSignal extends BaseEntity {
  @Column('uuid') ownerId!: string;
  @Column('uuid') sourceEventId!: string;
  @Column() eventName!: string;
  @Column() category!: 'inventory' | 'ledger' | 'approval';
  @Column() severity!: 'info' | 'attention';
  @Column({ length: 240 }) summary!: string;
  @Column({ type: 'jsonb', default: {} }) data!: Record<string, unknown>;
}

@Entity('platform_notifications')
@Index(['ownerId', 'createdAt'])
@Index(['recipientKey', 'readAt'])
export class PlatformNotification extends BaseEntity {
  @Column({ type: 'uuid', nullable: true }) ownerId?: string | null;
  @Column({ default: '' }) recipientKey!: string;
  @Column({ default: '' }) phone!: string;
  @Column({ default: '' }) email!: string;
  @Column() title!: string;
  @Column({ type: 'text' }) body!: string;
  @Column({ default: '' }) actionUrl!: string;
  @Column({ type: 'jsonb', default: [] }) requestedChannels!: string[];
  @Column({ type: 'jsonb', default: {} }) delivery!: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) readAt?: Date | null;
}

export const PLATFORM_ENTITIES = [PlatformDomainEvent, PlatformNotification, PlatformBusinessSignal] as const;
