import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('admin_companies')
export class AdminCompany extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  email!: string;

  @Column({ default: '' })
  country!: string;

  @Column({ default: 'Basic' })
  plan!: 'Basic' | 'Pro' | 'Enterprise';

  @Column({ default: 0 })
  users!: number;

  @Column({ default: 0 })
  modules!: number;

  @Column({ default: 'Active' })
  status!: 'Active' | 'Trial' | 'Expired' | 'Suspended';

  @Column({ type: 'float', default: 0 })
  revenue!: number;

  @Column({ nullable: true, type: 'varchar' })
  joined?: string | null;
}

@Entity('admin_subscriptions')
export class AdminSubscription extends OwnedEntity {
  @Column()
  company!: string;

  @Column({ default: 'Basic' })
  plan!: 'Basic' | 'Pro' | 'Enterprise';

  @Column({ type: 'float', default: 0 })
  price!: number;

  @Column({ nullable: true, type: 'varchar' })
  startDate?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  endDate?: string | null;

  @Column({ default: 'Active' })
  status!: 'Active' | 'Trial' | 'Expired' | 'Cancelled';

  @Column({ default: true })
  autoRenew!: boolean;
}

@Entity('admin_invoices')
export class AdminInvoice extends OwnedEntity {
  @Column()
  company!: string;

  @Column({ type: 'float', default: 0 })
  amount!: number;

  @Column({ nullable: true, type: 'varchar' })
  date?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  dueDate?: string | null;

  @Column({ default: 'Pending' })
  status!: 'Paid' | 'Pending' | 'Failed' | 'Overdue';
}

@Entity('admin_roles')
export class AdminRole extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ type: 'simple-array', default: '' })
  permissions!: string[];

  @Column({ default: 0 })
  userCount!: number;

  @Column({ default: false })
  builtIn!: boolean;
}

@Entity('admin_tickets')
export class AdminTicket extends OwnedEntity {
  @Column()
  company!: string;

  @Column()
  subject!: string;

  @Column({ default: 'Open' })
  status!: 'Open' | 'In Progress' | 'Resolved';

  @Column({ default: 'Medium' })
  priority!: 'Low' | 'Medium' | 'High' | 'Critical';

  @Column({ nullable: true, type: 'varchar' })
  created?: string | null;
}
