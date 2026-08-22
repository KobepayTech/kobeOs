import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('platform_domain_events')
@Index(['eventName', 'occurredAt'])
@Index(['ownerId', 'occurredAt'])
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

export const PLATFORM_ENTITIES = [PlatformDomainEvent, PlatformNotification] as const;
