import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Parcel lifecycle states — locked-down replacement for the freeform
 * `Parcel.status` string. Mirrors how warehouse staff actually move
 * a parcel through the system (matches BubbleBee WMS for ergonomics):
 *
 *   PRE_ALERTED       — customer told us a parcel is coming, no
 *                        physical arrival yet
 *   AWAITING_STORAGE  — physical parcel logged at the dock, not yet
 *                        on a shelf
 *   STORED            — on a shelf, waiting for consolidation
 *   ON_HOLD           — payment / customs / damage hold
 *   FOR_CONSOLIDATION — picked into a consolidation box but box not
 *                        sealed yet
 *   CONSOLIDATED      — sealed inside a box that's ready to dispatch
 *   IN_TRANSIT        — box has been dispatched / loaded on a flight
 *   OVERSEAS_RECEIVED — arrived at destination hub
 *   READY_FOR_PICKUP  — ready for the customer to collect / be delivered
 *   DELIVERED         — handed over to the customer
 */
export type ParcelLifecycleStatus =
  | 'PRE_ALERTED'
  | 'AWAITING_STORAGE'
  | 'STORED'
  | 'ON_HOLD'
  | 'FOR_CONSOLIDATION'
  | 'CONSOLIDATED'
  | 'IN_TRANSIT'
  | 'OVERSEAS_RECEIVED'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED';

export type ConsolidationBoxStatus = 'OPEN' | 'SEALED' | 'DISPATCHED' | 'OVERSEAS_RECEIVED' | 'EMPTIED';

@Entity('parcels')
@Index(['ownerId', 'parcelId'], { unique: true })
export class Parcel extends OwnedEntity {
  @Column()
  parcelId!: string;

  @Column()
  senderName!: string;

  @Column()
  senderPhone!: string;

  @Column()
  ownerName!: string;

  @Column()
  ownerPhone!: string;

  @Column()
  destination!: string;

  @Column({ default: 1 })
  packageCount!: number;

  @Column({ type: 'float', default: 0 })
  weight!: number;

  @Column({ default: '' })
  description!: string;

  @Column({ default: 'PAY_NOW' })
  paymentMode!: 'PAY_NOW' | 'PAY_ON_ARRIVAL';

  @Column({ default: 'REGISTERED' })
  status!: string;

  /** Owning cargo customer — null on legacy rows that pre-date the
   *  CargoCustomer registry. Populated when an operator creates the
   *  parcel from the customer page or when a pre-alert matches a
   *  registered customer by phone. */
  @Index()
  @Column('uuid', { nullable: true })
  customerId?: string | null;

  /** Consolidation box this parcel currently sits inside, when
   *  lifecycleStatus is FOR_CONSOLIDATION or later. */
  @Index()
  @Column('uuid', { nullable: true })
  boxId?: string | null;

  /** Locked-down state machine status (separate from legacy `status`
   *  string which we keep for backward compatibility). Drives the
   *  Pack tab filters in the cargo app. */
  @Index()
  @Column({ default: 'AWAITING_STORAGE' })
  lifecycleStatus!: ParcelLifecycleStatus;

  /** When the customer pre-notified us this parcel was coming. Null
   *  when the parcel was logged at the dock without a pre-alert. */
  @Column({ type: 'timestamptz', nullable: true })
  preAlertedAt?: Date | null;

  /** Carrier tracking number on the inbound side (e.g. YT8879481…),
   *  for cross-referencing the upstream carrier's tracking page. */
  @Column({ nullable: true, type: 'varchar' })
  externalTracking?: string | null;
}

@Entity('shipments')
export class Shipment extends OwnedEntity {
  @Index({ unique: true })
  @Column()
  shipmentId!: string;

  @Column()
  origin!: string;

  @Column()
  destination!: string;

  @Column({ type: 'float', default: 0 })
  weight!: number;

  @Column({ default: 'PENDING' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  etd?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  eta?: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  carrier?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  flightNumber?: string | null;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  driverId?: string | null;
}

@Entity('cargo_drivers')
export class CargoDriver extends OwnedEntity {
  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  vehicle?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  plateNumber?: string | null;

  @Column({ default: 'AVAILABLE' })
  status!: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';

  @Column({ type: 'float', default: 0 })
  rating!: number;
}

@Entity('cargo_flights')
export class CargoFlight extends OwnedEntity {
  @Index({ unique: true })
  @Column()
  flightNumber!: string;

  @Column()
  origin!: string;

  @Column()
  destination!: string;

  @Column({ type: 'timestamptz' })
  departureAt!: Date;

  @Column({ type: 'timestamptz' })
  arrivalAt!: Date;

  @Column({ default: 'SCHEDULED' })
  status!: string;

  @Column({ nullable: true, type: 'varchar' })
  carrier?: string | null;

  @Column({ type: 'float', default: 0 })
  capacityKg!: number;

  @Column({ type: 'float', default: 0 })
  bookedKg!: number;
}

export type CargoPaymentPurpose = 'DEPOSIT' | 'BALANCE' | 'FULL' | 'SHIPPING' | 'CUSTOMS';
export type CargoPaymentMethod = 'KOBEPAY' | 'BANK' | 'MOBILE_MONEY' | 'CASH' | 'CARD';
export type CargoPaymentStatus = 'PENDING' | 'COMPLETED' | 'REVERSED';

/**
 * Records a cashier-recorded payment against a parcel or shipment. Either
 * parcelId OR shipmentId must be set (validated in the DTO). Multiple
 * payments can attach to the same subject — e.g. a deposit followed by
 * a balance payment — and the frontend uses the running sum to drive
 * receipt copy.
 */
@Entity('cargo_payments')
export class CargoPayment extends OwnedEntity {
  @Index()
  @Column({ nullable: true, type: 'uuid' })
  parcelId?: string | null;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  shipmentId?: string | null;

  @Column()
  customerName!: string;

  @Column({ default: '' })
  customerPhone!: string;

  @Column({ nullable: true, type: 'varchar' })
  supplierName?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  supplierNumber?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'DEPOSIT' })
  purpose!: CargoPaymentPurpose;

  @Column({ default: 'CASH' })
  method!: CargoPaymentMethod;

  @Column({ nullable: true, type: 'varchar' })
  reference?: string | null;

  @Column({ default: '' })
  notes!: string;

  @Column({ default: 'COMPLETED' })
  status!: CargoPaymentStatus;
}

/**
 * Registered cargo customer. The `displayId` is the 3-character
 * "G29", "P12" badge written on physical parcels with a marker so
 * warehouse staff can find a parcel's owner at a glance. Generated
 * on insert by CargoCustomersService.create() — collision-free per
 * owner, leftmost char is uppercased letter, last two are 0-99.
 */
@Entity('cargo_customers')
@Index(['ownerId', 'displayId'], { unique: true })
export class CargoCustomer extends OwnedEntity {
  @Column({ length: 3 })
  displayId!: string;

  @Column()
  name!: string;

  @Index()
  @Column()
  phone!: string;

  @Column({ default: '' })
  country!: string;

  @Column({ nullable: true, type: 'varchar' })
  preferredLaneId?: string | null;

  /** Customer-facing wallet balance — credit on file for future
   *  shipments. Operator can top up via /cargo/customers/:id/credit. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  balance!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

/**
 * Named shipping lane — a pre-configured route + carrier combo the
 * operator picks from a dropdown. BubbleBee shows codes like
 * "TZASLK-G" / "TZASLK-S"; KobeOS keeps the code free-form so the
 * operator picks their own taxonomy. Each ConsolidationBox is
 * assigned to a lane.
 */
@Entity('cargo_lanes')
@Index(['ownerId', 'code'], { unique: true })
export class CargoLane extends OwnedEntity {
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  origin!: string;

  @Column({ default: '' })
  destination!: string;

  @Column({ nullable: true, type: 'varchar' })
  defaultCarrier?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  defaultAirlineCode?: string | null;

  /** Day-of-week dispatch schedule, e.g. ["TUE","FRI"]. Empty array
   *  means "on demand". */
  @Column({ type: 'jsonb', default: [] })
  dispatchDays!: string[];

  /** Price per kilogram quoted to customers booking on this lane. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  pricePerKg!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: true })
  active!: boolean;
}

/**
 * Consolidation box — groups parcels destined for the same lane
 * into a single physical container that becomes a Shipment when
 * dispatched. Sits between Parcel and Shipment in the cargo flow.
 *
 *   OPEN              — receiving more parcels
 *   SEALED            — finalised, no more parcels can be added
 *   DISPATCHED        — handed off to the carrier; becomes a Shipment
 *   OVERSEAS_RECEIVED — arrived at destination hub
 *   EMPTIED           — all parcels broken out for delivery
 */
@Entity('cargo_consolidation_boxes')
export class ConsolidationBox extends OwnedEntity {
  @Index({ unique: false })
  @Column()
  boxId!: string;

  @Index()
  @Column('uuid')
  laneId!: string;

  @Column()
  laneCode!: string;

  @Index()
  @Column({ default: 'OPEN' })
  status!: ConsolidationBoxStatus;

  /** Cached counts/weights so the UI doesn't have to re-aggregate
   *  the Parcel list on every page render. Recomputed by
   *  ConsolidationService.recountBox() on every assign / unassign. */
  @Column({ default: 0 })
  parcelCount!: number;

  @Column({ type: 'float', default: 0 })
  totalWeight!: number;

  /** Operator who sealed / dispatched the box — drives the
   *  accountability column on the Box tab. */
  @Column({ nullable: true, type: 'varchar' })
  sealedBy?: string | null;

  /** Shipment created when the box was dispatched. Null until then. */
  @Index()
  @Column('uuid', { nullable: true })
  shipmentId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sealedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt?: Date | null;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
