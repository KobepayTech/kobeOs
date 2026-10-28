import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import type { AllotmentStatus, OutboxKind } from './continuity.rules';

/**
 * Capacity handed to the online continuity layer.
 *
 * While an allotment is anything other than an acknowledged release, KobeOS
 * will not sell that room for those dates — the cloud may have committed it
 * and may not be reachable to ask.
 */
@Entity('cloud_room_allotments')
@Index(['ownerId', 'roomId', 'status'])
export class CloudRoomAllotment extends OwnedEntity {
  @Index()
  @Column('uuid')
  hotelId!: string;

  @Index()
  @Column('uuid')
  roomId!: string;

  /** Half-open, [fromDate, toDate), matching HotelBooking checkIn/checkOut. */
  @Column({ type: 'date' })
  fromDate!: Date;

  @Column({ type: 'date' })
  toDate!: Date;

  @Column({ default: 'ACTIVE' })
  status!: AllotmentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  reclaimRequestedAt?: Date | null;

  /**
   * When the cloud confirmed it will not commit this capacity. Only then may
   * KobeOS sell it again — an expired window is not enough on its own.
   */
  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date | null;

  @Column({ default: '' })
  note!: string;
}

/**
 * Everything the continuity layer originated, append-only.
 *
 * Rows are stamped on sync rather than deleted: during an outage this is the
 * only record that a guest was given a reservation, so it is evidence, not a
 * work queue to be drained and forgotten.
 */
@Entity('cloud_outbox')
@Index(['ownerId', 'syncedAt'])
// Replay safety. A retried sync carrying the same originId cannot create a
// second booking, order or stock deduction.
@Index('cloud_outbox_origin_uk', ['ownerId', 'kind', 'originId'], { unique: true })
export class CloudOutboxRecord extends OwnedEntity {
  @Column()
  kind!: OutboxKind;

  /** The id the cloud assigned. Unique per owner and kind. */
  @Column()
  originId!: string;

  @Column({ type: 'text', default: '{}' })
  payload!: string;

  @Column({ type: 'timestamptz', nullable: true })
  syncedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'text', default: '' })
  lastError!: string;
}
