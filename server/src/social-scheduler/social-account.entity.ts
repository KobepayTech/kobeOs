import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { socialTokenTransformer } from './social-token.transformer';

/**
 * A connected social media account. OAuth tokens are encrypted transparently
 * before they are written to PostgreSQL and decrypted only inside the backend.
 */
@Entity('social_accounts')
export class SocialAccount extends BaseEntity {
  @Index()
  @Column('uuid')
  ownerId!: string;

  /** Platform key — e.g. 'instagram', 'tiktok', 'facebook'. */
  @Column()
  platform!: string;

  @Column()
  accountName!: string;

  @Column()
  accountHandle!: string;

  /** OAuth access token — encrypted at rest by socialTokenTransformer. */
  @Column({ type: 'text', transformer: socialTokenTransformer })
  accessToken!: string;

  /** OAuth refresh token — encrypted at rest. */
  @Column({ type: 'text', nullable: true, transformer: socialTokenTransformer })
  refreshToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ default: 'connected' })
  status!: 'connected' | 'expired' | 'disconnected';

  @Column({ type: 'text', nullable: true })
  accountAvatar!: string | null;

  /** IDs, granted scopes, provider capability metadata, sync timestamps, etc. */
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
