import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('webhooks')
@Index(['provider', 'eventType'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  provider!: 'palmpesa' | 'mpesa' | 'stripe' | 'custom';

  @Column()
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ default: false })
  processed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ nullable: true })
  errorMessage?: string | null;

  @Column({ default: () => 'NOW()' })
  receivedAt!: Date;
}
