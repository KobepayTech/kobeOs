import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: '' })
  displayName!: string;

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl?: string | null;

  @Column({ default: 'user' })
  role!: 'user' | 'admin';
}
