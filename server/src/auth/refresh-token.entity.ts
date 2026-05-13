import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index()
  @Column('uuid')
  userId!: string;

  /** SHA-256 of the raw refresh-token string; we never store it in plaintext. */
  @Index({ unique: true })
  @Column()
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;
}
