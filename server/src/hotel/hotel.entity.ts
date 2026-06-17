import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_rooms')
export class HotelRoom extends OwnedEntity {
  @Index({ unique: false })
  @Column()
  roomNumber!: string;

  @Column()
  type!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  rate!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 2 })
  capacity!: number;

  @Column({ default: 'available' })
  status!: 'available' | 'occupied' | 'reserved' | 'maintenance';

  /** Property this room belongs to (HotelTenant.id). Nullable for legacy rows
   *  predating the multi-property switch — the controller treats missing
   *  hotelId as "any property" so the legacy single-hotel dashboard keeps
   *  working unchanged. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;
}

@Entity('hotel_guests')
export class HotelGuest extends OwnedEntity {
  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true, type: 'varchar' })
  email?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  nationality?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  idType?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  idNumber?: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;
}

@Entity('hotel_bookings')
export class HotelBooking extends OwnedEntity {
  @Index()
  @Column('uuid')
  roomId!: string;

  @Index()
  @Column('uuid')
  guestId!: string;

  @Column({ type: 'date' })
  checkIn!: Date;

  @Column({ type: 'date' })
  checkOut!: Date;

  @Column({ default: 1 })
  guestCount!: number;

  @Column({ default: 'CONFIRMED' })
  status!: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalAmount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;
}

@Entity('hotel_tenants')
export class HotelTenant extends OwnedEntity {
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  brandColor?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  logoUrl?: string | null;

  @Column({ default: 'TZS' })
  currency!: string;
}

@Entity('hotel_menu_items')
export class HotelMenuItem extends OwnedEntity {
  @Column()
  name!: string;

  @Column()
  category!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  price!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: true })
  available!: boolean;

  /** Which station prepares this item — drives KDS routing. */
  @Column({ default: 'kitchen' })
  station!: 'kitchen' | 'bar' | 'other';

  /** Scope to a single property when set; null = shared across the owner's
   *  properties (common for small chains that run one menu). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;
}

export { HotelChain } from './hotel-chain.entity';
export { HotelParkingSpot } from './hotel-parking.entity';
export { HotelFinancialRecord } from './hotel-financials.entity';

export interface HotelOrderItem {
  menuItemId?: string;
  name: string;
  qty: number;
  price: number;
  station?: 'kitchen' | 'bar' | 'other';
}

@Entity('hotel_orders')
export class HotelOrder extends OwnedEntity {
  @Index()
  @Column()
  roomNumber!: string;

  /** 'room' for in-room orders, 'table' for restaurant table orders. */
  @Column({ default: 'room' })
  locationType!: 'room' | 'table';

  @Column({ nullable: true, type: 'varchar' })
  guestName?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items!: HotelOrderItem[];

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  total!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'PENDING' })
  status!: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

  @Column({ default: '' })
  note!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;
}

@Entity('hotel_service_requests')
export class HotelServiceRequest extends OwnedEntity {
  @Index()
  @Column()
  roomNumber!: string;

  /** HOUSEKEEPING | TOWELS | WAKE_UP | EXTEND_STAY | CHECKOUT | OTHER */
  @Column()
  kind!: string;

  @Column({ default: '' })
  note!: string;

  @Column({ default: 'OPEN' })
  status!: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;
}
