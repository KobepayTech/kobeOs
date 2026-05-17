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
  payload!: Record<string, unknown>;

  @Column({ default: false })
  processed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  errorMessage?: string | null;

  @Column({ default: () => 'NOW()' })
  receivedAt!: Date;
}
