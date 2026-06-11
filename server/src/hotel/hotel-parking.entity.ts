import { Entity, Column, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_parking_spots')
export class HotelParkingSpot extends OwnedEntity {
  /** Which hotel this spot belongs to */
  @Index()
  @Column('uuid')
  hotelId!: string;

  @Column()
  spotNumber!: string;

  /** car, motorcycle, bus, handicap */
  @Column({ default: 'car' })
  type!: 'car' | 'motorcycle' | 'bus' | 'handicap';

  /** free, occupied, reserved, maintenance */
  @Column({ default: 'free' })
  status!: 'free' | 'occupied' | 'reserved' | 'maintenance';

  @Column({ nullable: true })
  vehiclePlate?: string;

  @Column({ nullable: true })
  vehicleModel?: string;

  @Column({ nullable: true, type: 'uuid' })
  guestId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reservedUntil?: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  ratePerDay!: number;
}
