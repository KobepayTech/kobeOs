import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Subscription } from '../subscriptions/subscription.entity';

export type CompanyStatus = 'Active' | 'Trial' | 'Suspended' | 'Cancelled';

@Entity('companies')
export class Company extends BaseEntity {
  @Column()
  name!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column({ nullable: true, type: 'varchar' })
  country?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  phone?: string | null;

  @Column({ default: 'Active' })
  status!: CompanyStatus;

  /** UUID of the user who owns/created this company record */
  @Index()
  @Column('uuid')
  ownerId!: string;

  @OneToMany(() => Subscription, (s) => s.company, { cascade: true })
  subscriptions!: Subscription[];
}
