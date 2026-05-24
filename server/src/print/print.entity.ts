import { Column, Entity } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('print_products')
export class PrintProduct extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  category!: string;

  @Column({ type: 'float', default: 0 })
  basePrice!: number;

  @Column({ default: '' })
  method!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ nullable: true, type: 'varchar' })
  icon?: string | null;
}

@Entity('print_jobs')
export class PrintJob extends OwnedEntity {
  @Column()
  product!: string;

  @Column({ default: '' })
  customer!: string;

  @Column({ default: '' })
  method!: string;

  @Column({ default: 1 })
  qty!: number;

  @Column({ default: 'Medium' })
  priority!: 'High' | 'Medium' | 'Low';

  @Column({ default: 'Pending' })
  status!: 'Pending' | 'Printing' | 'Finishing' | 'Completed';

  @Column({ nullable: true, type: 'varchar' })
  dueDate?: string | null;
}

@Entity('print_materials')
export class PrintMaterial extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  type!: string;

  @Column({ type: 'float', default: 0 })
  stock!: number;

  @Column({ default: 'pcs' })
  unit!: string;

  @Column({ type: 'float', default: 0 })
  minThreshold!: number;

  @Column({ nullable: true, type: 'varchar' })
  color?: string | null;
}

@Entity('print_customers')
export class PrintCustomer extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  contact!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  email?: string | null;

  @Column({ default: 'Active' })
  status!: string;

  @Column({ default: 0 })
  orders!: number;

  @Column({ type: 'float', default: 0 })
  totalSpent!: number;
}
