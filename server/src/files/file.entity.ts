import { Column, Entity, Index, Unique } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('vfs_nodes')
@Unique('uq_vfs_owner_path', ['ownerId', 'path'])
export class FsNode extends OwnedEntity {
  @Index()
  @Column()
  path!: string;

  @Index()
  @Column({ nullable: true, type: 'varchar' })
  parentPath?: string | null;

  @Column()
  name!: string;

  @Column({ default: 'file' })
  type!: 'file' | 'directory';

  @Column({ nullable: true, type: 'varchar' })
  mimeType?: string | null;

  @Column({ default: 0 })
  size!: number;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'bytea', nullable: true })
  contentBinary?: Buffer | null;
}
