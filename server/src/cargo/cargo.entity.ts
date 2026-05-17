import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

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
