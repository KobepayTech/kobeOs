import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  email!: string;

  /** Optional phone identifier. Phone-only accounts use an internal email
   * alias for legacy services while authenticating with this normalized value. */
  @Index('IDX_users_phone_unique', { unique: true, where: '"phone" IS NOT NULL' })
  @Column({ nullable: true, type: 'varchar' })
  phone?: string | null;

  @Column()
  passwordHash!: string;

  @Column({ default: '' })
  displayName!: string;

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl?: string | null;

  @Column({ default: 'user' })
  role!: 'user' | 'admin';
}
