import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import type { AppRole } from '../common/roles';

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

  /** Platform role — see server/src/common/roles.ts for full list */
  @Column({ default: 'user' })
  role!: AppRole;

  /** Country assignment for cashier/manager roles (e.g. 'Tanzania', 'China') */
  @Column({ nullable: true, type: 'varchar' })
  country?: string | null;
}
