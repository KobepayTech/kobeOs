import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Per-owner key→JSON store. Backs offline-first apps (e.g. the posys rental
 * PWA) that keep their whole state as one blob: the client mirrors it to
 * localStorage for offline use AND syncs it here so it survives device loss
 * and follows the owner across devices.
 */
@Entity('app_state')
@Index(['ownerId', 'key'], { unique: true })
export class AppState extends BaseEntity {
  @Column('uuid')
  ownerId!: string;

  @Column({ length: 80 })
  key!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  value!: unknown;
}
