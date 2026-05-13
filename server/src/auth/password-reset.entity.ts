import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('password_resets')
export class PasswordReset extends BaseEntity {
  @Index()
  @Column('uuid')
  userId!: string;

  @Index({ unique: true })
  @Column()
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ default: false })
  used!: boolean;
}
