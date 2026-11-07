import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import type { IntakeItemStatus, IntakeKind } from './intake.rules';

/**
 * One guided intake run: a batch of photos being turned into catalogue
 * entries, one question at a time.
 *
 * Stored rather than held in memory because a merchant photographing eighty
 * items will answer over several sittings, on a phone, on a connection that
 * drops. Losing the queue would mean re-uploading everything and re-answering
 * the ones already done, which is worse than the form this replaces.
 */
@Entity('intake_sessions')
@Index(['ownerId', 'status'])
export class IntakeSession extends OwnedEntity {
  @Column()
  kind!: IntakeKind;

  @Column({ default: 'OPEN' })
  status!: 'OPEN' | 'FINISHED' | 'ABANDONED';

  /**
   * Where created entries belong. A shop product needs the business; a room or
   * a dish needs the hotel. Null for a single-shop install that has only one.
   */
  @Column({ type: 'uuid', nullable: true })
  contextId?: string | null;

  @Column({ default: '' })
  note!: string;
}

/**
 * One photo in the queue, with whatever has been answered about it.
 *
 * The image bytes live in commerce_product_media under `imageToken`, the same
 * place quick-add puts them, so the photo is servable from
 * `/api/commerce-public/media/:token` while it is still being described — and
 * so it replicates to the cloud with the catalogue rather than needing a
 * second mechanism.
 */
@Entity('intake_items')
@Index(['sessionId', 'position'])
@Index(['ownerId', 'status'])
export class IntakeItem extends OwnedEntity {
  @Index()
  @Column('uuid')
  sessionId!: string;

  /** Order the photos were uploaded in, so the queue is predictable. */
  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ default: '' })
  imageToken!: string;

  @Column({ default: 'PENDING' })
  status!: IntakeItemStatus;

  /**
   * What the model read from the photo, cached after the first look. Vision is
   * slow and the same photo is shown again when someone goes back, so asking
   * twice would make the queue feel broken.
   */
  @Column({ type: 'jsonb', default: {} })
  suggestion!: Record<string, unknown>;

  /** Whether the model has been asked, so an empty suggestion is not retried
   * on every poll when no model is installed. */
  @Column({ default: false })
  suggestionAttempted!: boolean;

  @Column({ type: 'jsonb', default: {} })
  answers!: Record<string, unknown>;

  /** The product, room or menu item this photo became. */
  @Column({ type: 'uuid', nullable: true })
  createdId?: string | null;

  @Column({ type: 'text', default: '' })
  lastError!: string;
}
