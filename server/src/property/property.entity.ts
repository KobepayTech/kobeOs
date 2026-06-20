import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('properties')
export class Property extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  address!: string;

  @Column({ default: '' })
  city!: string;

  @Column({ default: '' })
  plotNo!: string;

  @Column({ default: '' })
  blockNo!: string;

  @Column({ default: 'residential' })
  type!: 'residential' | 'commercial' | 'mixed';

  @Column({ default: 0 })
  totalUnits!: number;

  /** Photo URL for dashboard cards + listing cover. */
  @Column({ default: '' })
  imageUrl!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

/**
 * Tenant screening report. One row per tenant per refresh. Each numeric
 * field is 0..100 (history coverage / risk score in the IRES sense),
 * `overallScore` is the FICO-style 300..850 composite. `verdict` is the
 * operator's decision after they see the report.
 */
@Entity('tenant_screening_reports')
@Index(['ownerId', 'tenantId'], { unique: false })
export class TenantScreeningReport extends OwnedEntity {
  @Index()
  @Column('uuid')
  tenantId!: string;

  @Column({ type: 'int', default: 0 })
  rentalHistoryPct!: number;

  @Column({ type: 'int', default: 0 })
  evictionHistoryPct!: number;

  @Column({ type: 'int', default: 0 })
  criminalHistoryPct!: number;

  @Column({ type: 'int', default: 0 })
  creditHistoryPct!: number;

  @Column({ type: 'int', default: 0 })
  overallScore!: number;

  @Column({ default: 'pending' })
  verdict!: 'pending' | 'accepted' | 'rejected';

  /** Provider this report came from (e.g. 'smartmove', 'rentprep',
   *  'manual', 'demo'). Lets us replace fixture rows when a real
   *  provider integration lands without disturbing the schema. */
  @Column({ default: 'demo' })
  provider!: string;

  /** Download URL for the full PDF report. */
  @Column({ default: '' })
  reportPdfUrl!: string;

  /** Download URL for the identity-proof JPG bundle. */
  @Column({ default: '' })
  identityProofUrl!: string;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;
}

@Entity('property_units')
export class PropertyUnit extends OwnedEntity {
  @Index()
  @Column('uuid')
  propertyId!: string;

  @Column()
  unitNumber!: string;

  @Column({ default: 'unit' })
  type!: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  bedrooms!: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  bathrooms!: number;

  @Column({ default: 0 })
  sqft!: number;

  @Column({ default: '' })
  floor!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  rentAmount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'vacant' })
  status!: 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('tenants')
export class Tenant extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  unitId?: string | null;

  @Column()
  name!: string;

  @Column({ default: '' })
  firstName!: string;

  @Column({ default: '' })
  middleName!: string;

  @Column({ default: '' })
  lastName!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  email?: string | null;

  @Column({ default: '' })
  profilePicUrl!: string;

  @Column({ default: '' })
  tin!: string;

  @Column({ default: '' })
  businessLicense!: string;

  @Column({ default: '' })
  employer!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  monthlyIncome!: number;

  @Column({ default: '' })
  emergencyContact!: string;

  @Index({ unique: false })
  @Column({ default: '' })
  shortCode!: string;

  @Index({ unique: false })
  @Column({ default: '' })
  paymentCode!: string;

  @Column({ type: 'date', nullable: true })
  leaseStart?: Date | null;

  @Column({ type: 'date', nullable: true })
  leaseEnd?: Date | null;

  @Column({ default: 'active' })
  status!: 'active' | 'past' | 'pending' | 'late' | 'moving_out';

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('property_leases')
export class PropertyLease extends OwnedEntity {
  @Index()
  @Column('uuid')
  unitId!: string;

  @Index()
  @Column('uuid')
  tenantId!: string;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date' })
  endDate!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  monthlyRent!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  deposit!: number;

  @Column({ default: 1 })
  rentDueDay!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  lateFee!: number;

  @Column({ default: 'active' })
  status!: 'upcoming' | 'active' | 'ended' | 'cancelled';

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('rent_charges')
@Index(['ownerId', 'leaseId', 'period'], { unique: true })
export class RentCharge extends OwnedEntity {
  @Index()
  @Column('uuid')
  leaseId!: string;

  @Index()
  @Column('uuid')
  tenantId!: string;

  @Index()
  @Column('uuid')
  unitId!: string;

  @Index()
  @Column()
  period!: string;

  @Column({ type: 'date' })
  dueDate!: Date;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amountPaid!: number;

  @Column({ default: 'open' })
  status!: 'open' | 'partial' | 'paid' | 'overdue' | 'waived';

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('rent_payments')
export class RentPayment extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  chargeId?: string | null;

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

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('property_vendors')
export class PropertyVendor extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: 'general' })
  category!: 'plumber' | 'electrician' | 'hvac' | 'handyman' | 'cleaning' | 'landscaping' | 'general';

  @Column({ default: '' })
  phone!: string;

  @Column({ default: '' })
  email!: string;

  @Column({ default: 'blue' })
  color!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('property_work_orders')
export class PropertyWorkOrder extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  propertyId?: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  unitId?: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  tenantId?: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  vendorId?: string | null;

  @Column()
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ default: 'normal' })
  priority!: 'low' | 'normal' | 'high' | 'urgent';

  @Column({ default: 'open' })
  status!: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  cost!: number;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('property_applications')
export class PropertyApplication extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  unitId?: string | null;

  @Column()
  firstName!: string;

  @Column({ default: '' })
  lastName!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: '' })
  email!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  monthlyIncome!: number;

  @Column({ default: '' })
  employer!: string;

  @Column({ type: 'date', nullable: true })
  desiredMoveIn?: Date | null;

  @Column({ default: 'new' })
  status!: 'new' | 'screening' | 'approved' | 'declined' | 'withdrawn';

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('property_settings')
@Index(['ownerId', 'key'], { unique: true })
export class PropertySetting extends OwnedEntity {
  @Column()
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}

@Entity('property_expenses')
export class PropertyExpense extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  propertyId?: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  unitId?: string | null;

  @Column()
  title!: string;

  @Column({ default: 'general' })
  category!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'date' })
  spentAt!: Date;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

@Entity('rent_increase_simulations')
export class RentIncreaseSimulation extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  propertyId?: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  increasePercent!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  currentMonthlyRent!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  projectedMonthlyRent!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  monthlyDifference!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  annualDifference!: number;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
