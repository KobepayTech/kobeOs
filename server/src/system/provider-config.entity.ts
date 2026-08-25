import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Server-side provider configuration. Public Meta values are kept separately
 * from the encrypted app secret so status endpoints can safely omit secrets.
 */
@Entity('provider_configs')
export class ProviderConfig extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 64 })
  provider!: string;

  @Column({ length: 255 })
  appId!: string;

  @Column({ type: 'text' })
  encryptedAppSecret!: string;

  @Column({ length: 500 })
  redirectUri!: string;

  @Column({ length: 128, default: '' })
  loginConfigId!: string;

  @Column({ length: 32, default: 'v26.0' })
  graphVersion!: string;

  @Column({ type: 'uuid', nullable: true })
  configuredBy!: string | null;
}
