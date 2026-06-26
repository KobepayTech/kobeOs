import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Kobe Mzigo — digital paper-waybill for TZ ground cargo. Replaces
 * the carbon-copy stubs at every PAX / Usinicom / Mailcom / bus
 * cargo desk in the country.
 *
 * Four roles in the flow:
 *   1. PACKAGER   — local person who wraps the parcel, fills the
 *                    owner/destination/recipient form, earns
 *                    commission points, picks a cargo agent.
 *   2. AGENT      — comes to pick the parcel up, confirms the form.
 *   3. WAREHOUSE  — receives the parcel, confirms manifest, assigns
 *                    to a driver + truck (a many-parcels-per-truck
 *                    manifest).
 *   4. DESTINATION — receiver at the destination hub scans the
 *                    truck plate, all parcels on that truck auto-
 *                    confirm received, every owner gets an SMS.
 */

/** Cargo company — wraps any number of agents. */
@Entity('mzigo_companies')
export class MzigoCompany extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 200 })
  name!: string;

  @Column({ length: 40, default: '' })
  phone!: string;

  @Column({ length: 200, default: '' })
  headOffice!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'float', default: 5 })
  rating!: number;
}

/** Pickup agent under a company. */
@Entity('mzigo_agents')
@Index(['companyId', 'phone'], { unique: true })
export class MzigoAgent extends BaseEntity {
  @Index()
  @Column('uuid')
  companyId!: string;

  @Column({ length: 200 })
  companyName!: string;

  @Column({ length: 200 })
  name!: string;

  @Index()
  @Column({ length: 40 })
  phone!: string;

  /** Approximate location label so a packager can pick the
   *  geographically-closest agent. "Kariakoo", "Mwenge", etc. */
  @Column({ length: 200, default: '' })
  area!: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'float', default: 5 })
  rating!: number;

  /** Commission points the agent has earned (e.g. 1 per parcel
   *  picked up). Redeemable later for whatever the company
   *  configures. */
  @Column({ default: 0 })
  commissionPoints!: number;
}

export type MzigoStatus =
  | 'REGISTERED'        // packager filled the form, no agent picked yet
  | 'AGENT_SELECTED'    // agent assigned, awaiting pickup
  | 'PICKED_UP'         // agent took it from the packager
  | 'AT_WAREHOUSE'      // arrived at the cargo warehouse
  | 'ON_TRUCK'          // loaded onto a specific truck/manifest
  | 'IN_TRANSIT'        // truck has departed
  | 'DELIVERED_DEST'    // destination hub received the truck
  | 'COLLECTED';        // owner picked up at destination

@Entity('mzigo_parcels')
@Index(['waybill'], { unique: true })
export class MzigoParcel extends BaseEntity {
  /** Customer-readable waybill number (KM-XXXXXX). Printed on the
   *  paper tag stuck to the physical parcel. */
  @Column({ length: 16 })
  waybill!: string;

  // ── Who packed it ──────────────────────────────────────────────
  @Column({ length: 200 })
  packagerName!: string;

  @Index()
  @Column({ length: 40 })
  packagerPhone!: string;

  // ── Goods owner (the person whose stuff this is) ───────────────
  @Column({ length: 200 })
  ownerName!: string;

  @Index()
  @Column({ length: 40 })
  ownerPhone!: string;

  /** Backup contact in case the owner phone is unreachable. */
  @Column({ length: 200, default: '' })
  ownerEmergencyName!: string;

  @Column({ length: 40, default: '' })
  ownerEmergencyPhone!: string;

  // ── Recipient (who picks it up at destination) ─────────────────
  @Column({ length: 200 })
  recipientName!: string;

  @Index()
  @Column({ length: 40 })
  recipientPhone!: string;

  @Column({ length: 40, default: '' })
  recipientEmergencyPhone!: string;

  // ── Route ──────────────────────────────────────────────────────
  @Column({ length: 200 })
  origin!: string;

  @Column({ length: 200 })
  destination!: string;

  @Column({ length: 200, default: '' })
  goodsType!: string;

  @Column({ type: 'float', default: 0 })
  weightKg!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  declaredValue!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  paymentAmount!: number;

  // ── Agent / company assigned ───────────────────────────────────
  @Index()
  @Column('uuid', { nullable: true })
  companyId?: string | null;

  @Column({ length: 200, default: '' })
  companyName!: string;

  @Index()
  @Column('uuid', { nullable: true })
  agentId?: string | null;

  @Column({ length: 200, default: '' })
  agentName!: string;

  // ── Lifecycle ──────────────────────────────────────────────────
  @Index()
  @Column({ length: 24, default: 'REGISTERED' })
  status!: MzigoStatus;

  @Column({ type: 'timestamptz', nullable: true }) pickedUpAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) atWarehouseAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) onTruckAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) inTransitAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deliveredAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) collectedAt?: Date | null;

  /** Truck currently carrying this parcel (when status >= ON_TRUCK).
   *  Plate number doubles as the "scan to receive" identifier at
   *  the destination hub. */
  @Index()
  @Column({ length: 24, default: '' })
  truckPlate!: string;

  @Column({ length: 200, default: '' })
  driverName!: string;

  @Column({ length: 40, default: '' })
  driverPhone!: string;

  @Column({ type: 'text', default: '' })
  notes!: string;
}

/** Truck manifest — created at the warehouse when loading. One
 *  truck plate carries many parcels for the same trip. */
@Entity('mzigo_truck_manifests')
@Index(['truckPlate', 'departedAt'])
export class MzigoTruckManifest extends OwnedEntity {
  @Column({ length: 24 })
  truckPlate!: string;

  @Column({ length: 200 })
  driverName!: string;

  @Column({ length: 40 })
  driverPhone!: string;

  @Column({ length: 200 })
  origin!: string;

  @Column({ length: 200 })
  destination!: string;

  @Column({ default: 0 })
  parcelCount!: number;

  @Column({ type: 'float', default: 0 })
  totalWeightKg!: number;

  @Index()
  @Column({ length: 24, default: 'LOADING' })
  status!: 'LOADING' | 'IN_TRANSIT' | 'DELIVERED';

  @Column({ type: 'timestamptz', nullable: true })
  departedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  arrivedAt?: Date | null;
}
