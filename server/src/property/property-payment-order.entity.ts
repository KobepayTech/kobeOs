import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

const numeric = {
  to: (value: number | string) => value,
  from: (value: string | number | null | undefined) => value == null ? 0 : Number(value),
};

export type PropertyPaymentOrderStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED';
export type CollectionPartnerType = 'BANK' | 'AGENT';
export type CollectionChannel = 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'CARD';

@Entity('property_collection_partners')
@Index(['ownerId', 'partnerCode'], { unique: true })
export class PropertyCollectionPartner extends OwnedEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ length: 20 })
  type!: CollectionPartnerType;

  @Index()
  @Column({ length: 30 })
  partnerCode!: string;

  /** salt:hash; the raw PIN is never stored. */
  @Column({ length: 256 })
  pinHash!: string;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0, transformer: numeric })
  commissionPct!: number;

  @Column({ default: 'ACTIVE' })
  status!: 'ACTIVE' | 'SUSPENDED';

  @Column({ default: '' })
  phone!: string;

  @Column({ default: '' })
  branch!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;
}

@Entity('property_payment_orders')
@Index(['ownerId', 'status'])
@Index(['ownerId', 'tenantId'])
export class PropertyPaymentOrder extends OwnedEntity {
  @Index({ unique: true })
  @Column({ length: 16 })
  code!: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  publicToken!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  unitId!: string;

  @Column('uuid', { nullable: true })
  chargeId?: string | null;

  @Column({ default: '' })
  invoiceReference!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: numeric })
  expectedAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  paidAmount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  allowedVariance!: number;

  @Column({ default: false })
  partialAllowed!: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  allowedChannels!: CollectionChannel[];

  @Column('uuid', { nullable: true })
  assignedPartnerId?: string | null;

  @Column({ default: 'ACTIVE' })
  status!: PropertyPaymentOrderStatus;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ default: '' })
  cancellationReason!: string;
}

@Entity('property_payment_redemptions')
@Index(['ownerId', 'idempotencyKey'], { unique: true })
@Index(['ownerId', 'orderId'])
@Index(['ownerId', 'partnerId'])
export class PropertyPaymentRedemption extends OwnedEntity {
  @Column('uuid')
  orderId!: string;

  @Column('uuid')
  partnerId!: string;

  @Column({ length: 120 })
  idempotencyKey!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, transformer: numeric })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ length: 30 })
  channel!: CollectionChannel;

  @Column({ default: '' })
  reference!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  commissionAmount!: number;

  @Column({ default: 'CONFIRMED' })
  status!: 'CONFIRMED' | 'REVERSED';

  @Column({ type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reversedAt?: Date | null;

  @Column({ default: '' })
  reversalReason!: string;
}
