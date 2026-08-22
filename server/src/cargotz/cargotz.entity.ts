import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Cargo TZ — domestic ground/bus cargo for a single company. Replaces the
 * handwritten bus-parcel receipt: a receiving agent enters a parcel once, the
 * system mints a tracking number + QR, and every later stage (warehouse,
 * loading, transit, pickup) just scans the QR and advances the status. The
 * owner sees every parcel in real time.
 *
 * Per-owner (ownerId = the cargo company's KobeOS account); staff are
 * sub-users with a role, mirroring the KobePay cashier model.
 */
export const CTZ_STATUSES = [
  'RECEIVED_AT_SHOP',   // agent took it from the customer
  'AT_WAREHOUSE',       // arrived at the origin warehouse
  'PACKED',             // shelved/bagged, ready to load
  'LOADED',             // on the bus
  'IN_TRANSIT',         // bus departed
  'ARRIVED',            // reached destination warehouse
  'READY_FOR_PICKUP',   // customer can collect
  'DELIVERED',          // collected
  'CANCELLED',
] as const;
export type CtzStatus = (typeof CTZ_STATUSES)[number];

export type CtzRole = 'Owner' | 'Agent' | 'Warehouse';

@Entity('ctz_staff')
@Index(['ownerId', 'pin'], { unique: true })
export class CtzStaff extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: 'Agent' })
  role!: CtzRole;

  @Column({ default: true })
  active!: boolean;

  /** 4-digit pin the staffer types on the shared device. */
  @Column({ default: '0000' })
  pin!: string;

  /** Warehouse this staffer is assigned to (free text location). */
  @Column({ default: '' })
  warehouse!: string;
}

@Entity('ctz_parcels')
@Index(['ownerId', 'status'])
export class CtzParcel extends OwnedEntity {
  /** Customer-facing tracking number, e.g. CTZ-20260711-000234. The QR
   *  encodes exactly this string. Globally unique so public tracking by
   *  number alone is unambiguous across companies. */
  @Index({ unique: true })
  @Column()
  trackingNumber!: string;

  /* ── Sender ── */
  @Column()
  senderName!: string;
  @Column()
  senderPhone!: string;
  @Column({ default: '' })
  senderId!: string;

  /* ── Receiver ── */
  @Column()
  receiverName!: string;
  @Column()
  receiverPhone!: string;

  /* ── Parcel ── */
  @Column({ default: '' })
  parcelType!: string;
  @Column({ default: '' })
  description!: string;
  @Column({ default: 1 })
  quantity!: number;
  @Column({ type: 'float', default: 0 })
  weight!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  value!: number;

  /* ── Route ── */
  @Column()
  origin!: string;
  @Column()
  destination!: string;

  /* ── Charges ── */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  transportFee!: number;
  @Column({ default: 'UNPAID' })
  paymentStatus!: 'PAID' | 'UNPAID';

  /* ── State ── */
  @Index()
  @Column({ default: 'RECEIVED_AT_SHOP' })
  status!: CtzStatus;
  @Column({ default: '' })
  currentLocation!: string;

  /* ── Handling flags / notes ── */
  @Column({ default: false })
  fragile!: boolean;
  @Column({ default: false })
  cashOnDelivery!: boolean;
  @Column({ type: 'text', default: '' })
  notes!: string;
  @Column({ default: '', type: 'varchar' })
  photoUrl!: string;

  @Column({ default: '' })
  receivedByName!: string;
}

@Entity('ctz_warehouse')
@Index(['ownerId', 'parcelId'], { unique: true })
export class CtzWarehouse extends OwnedEntity {
  @Index()
  @Column('uuid')
  parcelId!: string;

  @Column({ default: '' })
  warehouseLocation!: string;
  @Column({ default: '' })
  shelfNumber!: string;
  @Column({ default: '' })
  bagNumber!: string;
  @Column({ default: '' })
  busNumber!: string;
  @Column({ default: '' })
  driverName!: string;
  @Column({ default: '' })
  driverPhone!: string;
  @Column({ type: 'timestamptz', nullable: true })
  departureTime?: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  expectedArrival?: Date | null;
  @Column({ default: '' })
  packedBy!: string;
  @Column({ type: 'timestamptz', nullable: true })
  packedAt?: Date | null;
}

@Entity('ctz_status_events')
@Index(['ownerId', 'parcelId'])
export class CtzStatusEvent extends OwnedEntity {
  @Index()
  @Column('uuid')
  parcelId!: string;

  @Column()
  status!: CtzStatus;

  @Column({ default: '' })
  updatedByName!: string;

  @Column({ default: '' })
  location!: string;

  @Column({ default: '' })
  note!: string;
}
