import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type MediaInboxStatus = 'UNPROCESSED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

@Entity('media_inbox_items')
@Index(['ownerId', 'status', 'createdAt'])
@Index(['ownerId', 'sha256'])
@Index(['ownerId', 'moduleId', 'entityType'])
export class MediaInboxItem extends OwnedEntity {
  @Column('uuid')
  assetId!: string;

  @Column({ length: 64 })
  sha256!: string;

  @Column()
  originalName!: string;

  @Column()
  mimeType!: string;

  @Column({ type: 'bigint' })
  sizeBytes!: number;

  @Column({ type: 'int', nullable: true })
  width?: number | null;

  @Column({ type: 'int', nullable: true })
  height?: number | null;

  @Column()
  url!: string;

  @Column({ default: 'UNPROCESSED' })
  status!: MediaInboxStatus;

  /** Virtual gallery path used by every module. */
  @Column({ default: 'unprocessed' })
  folder!: string;

  @Column({ default: '' })
  moduleId!: string;

  @Column({ default: '' })
  entityType!: string;

  @Column('uuid', { nullable: true })
  entityId?: string | null;

  @Column({ default: '' })
  category!: string;

  @Column({ default: '' })
  subcategory!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  aiSuggestions!: Record<string, unknown>;

  @Column({ default: '' })
  error!: string;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;
}
