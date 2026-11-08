import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import type { CtzParcel } from './cargotz.entity';

export const cargoBranchKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export const cargoShipmentKey = (parcel: Pick<CtzParcel, 'id' | 'collectionId' | 'collectorAccessId'>) =>
  parcel.collectionId && parcel.collectorAccessId ? `${parcel.collectorAccessId}:${parcel.collectionId}` : parcel.id;

export const CTZ_OPERATION_ROLES = ['Intake', 'Dispatch', 'Loading', 'Destination'] as const;
export type CtzOperationRole = typeof CTZ_OPERATION_ROLES[number];
export type CtzTripStatus = 'LOADING' | 'LOADED' | 'IN_TRANSIT' | 'ARRIVED' | 'CANCELLED';

@Entity('ctz_operators')
@Index('UQ_ctz_operator_role', ['ownerId', 'accountId', 'role', 'branchKey'], { unique: true })
@Index('IDX_ctz_operator_account', ['accountId'])
export class CtzOperator extends OwnedEntity {
  @Column('uuid') accountId!: string;
  @Column() role!: CtzOperationRole;
  @Column() branch!: string;
  @Column() branchKey!: string;
  @Column() name!: string;
}

@Entity('ctz_trips')
@Index('IDX_ctz_trip_owner_status', ['ownerId', 'status'])
@Index('UQ_ctz_trip_active_plate', ['ownerId', 'plateKey'], {
  unique: true, where: '"status" IN (\'LOADING\', \'LOADED\', \'IN_TRANSIT\')',
})
export class CtzTrip extends OwnedEntity {
  @Column() origin!: string;
  @Column() plate!: string;
  @Column() plateKey!: string;
  @Column() vehicleType!: string;
  @Column() operator!: string;
  @Column() status!: CtzTripStatus;
  @Column('jsonb') stops!: { branch: string; key: string; arrivedAt: string | null; extraCartons?: string[] }[];
  @Column('timestamptz', { nullable: true }) sealedAt!: Date | null;
  @Column('timestamptz', { nullable: true }) departedAt!: Date | null;
}

@Entity('ctz_pickups')
@Index('UQ_ctz_pickup_shipment', ['ownerId', 'shipmentKey'], { unique: true })
export class CtzPickup extends OwnedEntity {
  @Column() shipmentKey!: string;
  @Column({ select: false }) codeHash!: string;
  @Column('int', { default: 0 }) attempts!: number;
  @Column('timestamptz', { nullable: true }) lockedUntil!: Date | null;
  @Column('timestamptz', { nullable: true }) collectedAt!: Date | null;
}

@Entity('ctz_sms_outbox')
@Index('UQ_ctz_sms_event', ['ownerId', 'eventKey'], { unique: true })
@Index('IDX_ctz_sms_due', ['nextAttemptAt'], { where: '"sentAt" IS NULL' })
export class CtzSmsOutbox extends OwnedEntity {
  @Column('uuid') tripId!: string;
  @Column() branchKey!: string;
  @Column() eventKey!: string;
  @Column() phone!: string;
  @Column('text') body!: string;
  @Column('int', { default: 0 }) attempts!: number;
  @Column('timestamptz') nextAttemptAt!: Date;
  @Column('timestamptz', { nullable: true }) sentAt!: Date | null;
}

@Entity('ctz_tracking_challenges')
@Index('UQ_ctz_tracking_challenge', ['ownerId', 'shipmentKey'], { unique: true })
export class CtzTrackingChallenge extends OwnedEntity {
  @Column() shipmentKey!: string;
  @Column('varchar', { nullable: true }) codeHash!: string | null;
  @Column('timestamptz', { nullable: true }) sentAt!: Date | null;
  @Column('timestamptz', { nullable: true }) expiresAt!: Date | null;
  @Column('timestamptz', { nullable: true }) windowStart!: Date | null;
  @Column('int', { default: 0 }) attempts!: number;
  @Column('int', { default: 0 }) sends!: number;
}
