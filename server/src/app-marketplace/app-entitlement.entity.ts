import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type AppEntitlementStatus =
  | 'trialing'
  | 'active'
  | 'expired'
  | 'pending'
  | 'failed';

@Entity('app_entitlements')
@Index(['userId', 'appId'], { unique: true })
export class AppEntitlement extends BaseEntity {
  @Index()
  @Column('uuid')
  userId!: string;

  @Index()
  @Column()
  appId!: string;

  @Index()
  @Column({ default: 'trialing' })
  status!: AppEntitlementStatus;

  @Column({ type: 'timestamptz' })
  installedAt!: Date;

  @Column({ type: 'timestamptz' })
  trialEndsAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEndsAt?: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  amountTzs!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountUsd!: number;

  @Column({ nullable: true, type: 'varchar' })
  provider?: 'palmpesa' | 'paypal' | null;

  @Index()
  @Column({ nullable: true, type: 'varchar' })
  transactionId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  palmPesaOrderId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  palmPesaTransId?: string | null;

  @Index()
  @Column({ nullable: true, type: 'varchar' })
  paypalOrderId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  channel?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  callbackPayload?: Record<string, unknown> | null;
}
