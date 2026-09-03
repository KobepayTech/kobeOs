import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('media_assets')
export class MediaAsset extends OwnedEntity {
  /**
   * Permanent unguessable token used to serve the bytes publicly at
   * /api/media-public/:token. An <img> tag cannot send an Authorization header,
   * so inline media must have an unauthenticated URL or it renders broken in
   * the app, on products bound to it, and on the public storefront.
   */
  @Index({ unique: true })
  @Column({ nullable: true, type: 'varchar' })
  publicToken?: string | null;

  @Column()
  kind!: 'photo' | 'audio' | 'video' | 'image';

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  mimeType?: string | null;

  /**
   * Either a data URL, an external URL, or `/api/media-public/:token` when the
   * bytes are stored inline in `contentBinary` via the multipart upload route.
   */
  @Column()
  src!: string;

  @Column({ type: 'bytea', nullable: true })
  contentBinary?: Buffer | null;

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
