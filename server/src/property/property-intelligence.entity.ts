import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('property_assets')
export class PropertyAsset extends OwnedEntity {
  @Column('uuid') propertyId!: string;
  @Column({ type: 'uuid', nullable: true }) unitId!: string | null;
  @Column() name!: string;
  @Column({ default: 'general' }) category!: string;
  @Column({ type: 'date' }) lastServiced!: string;
  @Column({ default: 90 }) intervalDays!: number;
}
@Entity('property_utility_bills')
@Index(['ownerId', 'unitId', 'kind', 'period'], { unique: true })
export class PropertyUtilityBill extends OwnedEntity {
  @Column('uuid') unitId!: string;
  @Column('uuid') tenantId!: string;
  @Column() kind!: string;
  @Column() period!: string;
  @Column('decimal', { precision: 18, scale: 4 }) previousReading!: number;
  @Column('decimal', { precision: 18, scale: 4 }) currentReading!: number;
  @Column('decimal', { precision: 18, scale: 4 }) unitRate!: number;
  @Column('decimal', { precision: 18, scale: 4 }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'date' }) dueDate!: string;
  @Column({ default: 'open' }) status!: 'open' | 'paid';
  @Column({ default: '' }) paymentReference!: string;
}
@Entity('property_inspections')
export class PropertyInspection extends OwnedEntity {
  @Column('uuid') unitId!: string;
  @Column() kind!: string;
  @Column({ type: 'date' }) inspectedAt!: string;
  @Column({ type: 'jsonb', default: [] }) items!: Array<{ area: string; condition: string; note: string; photoUrl?: string }>;
  @Column({ default: '' }) notes!: string;
}
@Entity('property_deposit_entries')
@Index(['ownerId', 'requestKey'], { unique: true })
export class PropertyDepositEntry extends OwnedEntity {
  @Column('uuid') leaseId!: string;
  @Column('uuid') requestKey!: string;
  @Column() kind!: 'receipt' | 'refund' | 'deduction';
  @Column('decimal', { precision: 18, scale: 4 }) amount!: number;
  @Column() currency!: string;
  @Column() reference!: string;
  @Column({ type: 'text', default: '' }) reason!: string;
}
@Entity('property_portal_access')
@Index(['tokenHash'], { unique: true })
export class PropertyPortalAccess extends OwnedEntity {
  @Column('uuid') tenantId!: string;
  @Column({ select: false }) tokenHash!: string;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ default: false }) revoked!: boolean;
}
/** Durable proposals/approvals and receipts for idempotent operations. */
@Entity('property_operations')
@Index(['ownerId', 'key'], { unique: true })
export class PropertyOperation extends OwnedEntity {
  @Column() key!: string;
  @Column() kind!: string;
  @Column({ default: 'pending' }) status!: 'pending' | 'completed' | 'failed';
  @Column({ type: 'jsonb', default: {} }) payload!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) result!: Record<string, unknown>;
}
export const PROPERTY_INTELLIGENCE_ENTITIES = [PropertyAsset, PropertyUtilityBill, PropertyInspection, PropertyDepositEntry, PropertyPortalAccess, PropertyOperation];
