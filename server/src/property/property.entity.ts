import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('properties')
export class Property extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  address!: string;

  @Column({ default: 'residential' })
  type!: 'residential' | 'commercial' | 'mixed';

  @Column({ default: 0 })
  totalUnits!: number;
}

@Entity('property_units')
export class PropertyUnit extends OwnedEntity {
  @Index()
  @Column('uuid')
  propertyId!: string;

  @Column()
  unitNumber!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  rentAmount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'vacant' })
  status!: 'vacant' | 'occupied' | 'maintenance';
}

@Entity('tenants')
export class Tenant extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  unitId?: string | null;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  email?: string | null;

  @Column({ type: 'date', nullable: true })
  leaseStart?: Date | null;

  @Column({ type: 'date', nullable: true })
  leaseEnd?: Date | null;

  @Column({ default: 'active' })
  status!: 'active' | 'past' | 'pending';
}

@Entity('rent_payments')
export class RentPayment extends OwnedEntity {
  @Index()
  @Column('uuid')
  tenantId!: string;

  @Index()
  @Column('uuid')
  unitId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'date' })
  forMonth!: Date;

  @Column({ type: 'timestamptz' })
  paidAt!: Date;

  @Column({ default: 'CASH' })
  method!: string;

  @Column({ nullable: true, type: 'varchar' })
  reference?: string | null;
}
