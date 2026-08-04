import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type HotelDepartment = 'bar' | 'kitchen' | 'cleaning' | 'room-amenities';
export type RequisitionStatus = 'PENDING' | 'APPROVED' | 'PURCHASED' | 'CANCELLED';

export interface HotelRequisitionLine {
  inventoryId?: string;
  name: string;
  quantity: number;
  approvedQuantity?: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
}

/** Department requests are quantity-first. Prices are only required when an
 * accountant reviews or purchases the request. */
@Entity('hotel_procurement_requests')
@Index(['ownerId', 'status'])
export class HotelProcurementRequest extends OwnedEntity {
  @Column() department!: HotelDepartment;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) lines!: HotelRequisitionLine[];
  @Column({ default: 'PENDING' }) status!: RequisitionStatus;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) note!: string;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
  @Column({ nullable: true }) reviewedBy?: string | null;
  @Column({ type: 'timestamptz', nullable: true }) purchasedAt?: Date | null;
}

@Entity('hotel_payroll_records')
@Index(['ownerId', 'period'])
export class HotelPayrollRecord extends OwnedEntity {
  @Column() employeeName!: string;
  @Column({ type: 'uuid', nullable: true }) staffId?: string | null;
  @Column() period!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) baseSalary!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) overtime!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) allowances!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) deductions!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) netPay!: number;
  @Column({ default: 'POSTED' }) status!: 'POSTED' | 'PAID' | 'VOID';
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
  @Column({ type: 'timestamptz', nullable: true }) paidAt?: Date | null;
  @Column({ default: '' }) note!: string;
}

@Entity('hotel_petty_cash_entries')
@Index(['ownerId', 'entryDate'])
export class HotelPettyCashEntry extends OwnedEntity {
  @Column({ default: 'expense' }) kind!: 'expense' | 'top_up';
  @Column({ default: 'general' }) category!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) amount!: number;
  @Column() description!: string;
  @Column({ default: '' }) paidTo!: string;
  @Column({ default: '' }) reference!: string;
  @Column({ type: 'date' }) entryDate!: string;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
}

@Entity('hotel_assets')
@Index(['ownerId', 'assetCode'], { unique: true })
export class HotelAsset extends OwnedEntity {
  @Column() assetCode!: string;
  @Column() name!: string;
  @Column({ default: 'hotel equipment' }) category!: string;
  @Column({ type: 'date' }) acquisitionDate!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) acquisitionCost!: number;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) residualValue!: number;
  @Column({ default: 60 }) usefulLifeMonths!: number;
  @Column({ default: 'straight_line' }) depreciationMethod!: 'straight_line';
  @Column({ default: 'active' }) status!: 'active' | 'disposed';
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
  @Column({ default: '' }) note!: string;
}

@Entity('hotel_ledger_entries')
@Index(['ownerId', 'entryDate'])
export class HotelLedgerEntry extends OwnedEntity {
  @Column({ type: 'date' }) entryDate!: string;
  @Column() account!: string;
  @Column({ default: 'general' }) department!: string;
  @Column({ default: 'debit' }) side!: 'debit' | 'credit';
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) description!: string;
  @Column({ default: 'manual' }) sourceType!: string;
  @Column({ type: 'uuid', nullable: true }) sourceId?: string | null;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
}
