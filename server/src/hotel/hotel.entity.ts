import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('hotel_rooms')
export class HotelRoom extends OwnedEntity {
  @Index({ unique: false })
  @Column()
  roomNumber!: string;

  @Column()
  type!: string;

  @Column({ type: 'float', default: 0 })
  rate!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 2 })
  capacity!: number;

  @Column({ default: 'available' })
  status!: 'available' | 'occupied' | 'reserved' | 'maintenance';
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

  @Column({ type: 'float', default: 0 })
  totalAmount!: number;

  @Column({ default: 'TZS' })
  currency!: string;
}
