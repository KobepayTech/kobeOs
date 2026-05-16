import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Company } from '../companies/company.entity';

export type SubscriptionPlan = 'Basic' | 'Pro' | 'Enterprise';
export type SubscriptionStatus = 'Trial' | 'Active' | 'Expired' | 'Cancelled';

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @Index()
  @Column('uuid')
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @Column({ default: 'Basic' })
  plan!: SubscriptionPlan;

  /** Monthly price in USD */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 49 })
  price!: number;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @Column({ default: 'Trial' })
  status!: SubscriptionStatus;

  @Column({ default: false })
  autoRenew!: boolean;

  /** Modules enabled for this subscription (stored as JSON array of module IDs) */
  @Column({ type: 'jsonb', default: [] })
  enabledModules!: string[];
}
