import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/** Hash-only storage for the short-lived QR pairing token. */
@Entity('provider_setup_sessions')
export class ProviderSetupSession extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash!: string;

  @Column({ length: 64, default: 'meta' })
  provider!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;
}
