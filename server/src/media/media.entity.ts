import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('media_assets')
export class MediaAsset extends OwnedEntity {
  @Column()
  kind!: 'photo' | 'audio' | 'video' | 'image';

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  mimeType?: string | null;

  /** Pointer to /api/files virtual path or external URL */
  @Column()
  src!: string;

  @Column({ default: 0 })
  duration!: number;

  @Column({ default: 0 })
  size!: number;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown> | null;
}

@Entity('playlists')
export class Playlist extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ type: 'simple-array', default: '' })
  trackIds!: string[];
}
