import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/** Bar / kitchen / housekeeping stock. */
@Entity('hotel_inventory_items')
@Index(['ownerId', 'category'])
export class HotelInventoryItem extends OwnedEntity {
  @Column() name!: string;
  @Column({ default: 'general' }) category!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) quantity!: number;
  @Column({ default: 'unit' }) unit!: string;
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 }) reorderLevel!: number;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 }) costPerUnit!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
}

/** Staff roster. */
@Entity('hotel_staff')
@Index(['ownerId', 'role'])
export class HotelStaff extends OwnedEntity {
  @Column() name!: string;
  @Column({ default: 'staff' }) role!: string; // manager | reception | housekeeping | kitchen | bar | security | staff
  @Column({ default: '' }) phone!: string;
  @Column({ nullable: true, type: 'varchar' }) email?: string | null;
  @Column({ default: 'active' }) status!: 'active' | 'off' | 'suspended';
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
}

/** OTA / distribution channels (Booking.com, Airbnb, direct, …). */
@Entity('hotel_channels')
export class HotelChannel extends OwnedEntity {
  @Column() name!: string;
  @Column({ default: 'ota' }) type!: string;
  @Column({ default: false }) connected!: boolean;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) commissionPct!: number;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncAt?: Date | null;
  @Column({ type: 'uuid', nullable: true }) hotelId?: string | null;
}
