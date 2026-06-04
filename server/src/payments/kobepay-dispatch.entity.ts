import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type DispatchAttemptStatus = 'pending' | 'in_flight' | 'succeeded' | 'exhausted';

/**
 * Outbound queue row: every receipt KobePay needs to push to an ERP
 * customer's install. Created when the inline dispatch fails so the
 * scheduled retry worker can pick it up. Successful inline dispatches
 * also write a 'succeeded' row so admins can audit delivery history.
 */
@Entity('kobepay_dispatch_attempts')
export class KobepayDispatchAttempt extends OwnedEntity {
  @Index()
  @Column('uuid')
  depositId!: string;

  @Index()
  @Column('uuid', { nullable: true })
  customerId?: string | null;

  @Column()
  endpointUrl!: string;

  /** Snapshot of the payload as it should hit the wire. */
  @Column({ type: 'simple-json' })
  payload!: Record<string, unknown>;

  /** Snapshot of the bearer key — captured so a rotated key doesn't
   *  invalidate already-queued retries. */
  @Column()
  apiKey!: string;

  @Column({ default: 0 })
  attemptCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastTriedAt?: Date | null;

  @Index()
  @Column({ type: 'timestamptz' })
  nextRetryAt!: Date;

  @Column({ default: 0 })
  lastStatus!: number;

  @Column({ default: '' })
  lastError!: string;

  @Index()
  @Column({ default: 'pending' })
  status!: DispatchAttemptStatus;
}
