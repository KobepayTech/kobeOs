import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export interface DeveloperAppManifest {
  apiVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  permissions: Array<'inventory.read'>;
}

@Entity('developer_app_listings')
export class DeveloperAppListing {
  @PrimaryColumn({ length: 80 }) appId!: string;
  @Column('uuid') publisherId!: string;
}

@Entity('developer_app_releases')
@Index(['appId', 'version'], { unique: true })
export class DeveloperAppRelease extends BaseEntity {
  @Column({ length: 80 }) appId!: string;
  @Column('uuid') publisherId!: string;
  @Column({ length: 32 }) version!: string;
  @Column('jsonb') manifest!: DeveloperAppManifest;
  @Column('text') html!: string;
  @Column({ length: 64 }) digest!: string;
  @Column({ default: 'pending', length: 16 }) status!: 'pending' | 'approved' | 'rejected' | 'revoked';
  @Column({ type: 'uuid', nullable: true }) reviewerId!: string | null;
  @Column({ type: 'text', default: '' }) reviewNote!: string;
}

@Entity('developer_app_installs')
@Index(['ownerId', 'appId'], { unique: true })
export class DeveloperAppInstall extends BaseEntity {
  @Column('uuid') ownerId!: string;
  @Column({ length: 80 }) appId!: string;
  @Column('uuid') releaseId!: string;
  @Column('jsonb') grants!: string[];
}
