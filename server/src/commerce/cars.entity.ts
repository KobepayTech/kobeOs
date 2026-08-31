import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('commerce_vehicles')
@Index(['businessId', 'status'])
export class CommerceVehicle extends BaseEntity {
  @Column('uuid') businessId!: string;
  @Column('uuid') catalogOwnerId!: string;
  @Column() stockNumber!: string;
  @Column() make!: string;
  @Column() model!: string;
  @Column({ type: 'int' }) year!: number;
  @Column({ default: '' }) trim!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) price!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'int', default: 0 }) mileage!: number;
  @Column({ default: '' }) transmission!: string;
  @Column({ default: '' }) fuel!: string;
  @Column({ default: '' }) color!: string;
  @Column({ default: '' }) interiorColor!: string;
  @Column({ default: '' }) engine!: string;
  @Column({ default: '' }) driveType!: string;
  @Column({ default: '' }) bodyType!: string;
  @Column({ default: '' }) vin!: string;
  @Column({ default: '' }) registration!: string;
  @Column({ default: '' }) dutyStatus!: string;
  @Column({ default: 'LOCAL' }) source!: 'LOCAL' | 'IMPORTED';
  @Column({ default: false }) financingAvailable!: boolean;
  @Column({ default: false }) negotiable!: boolean;
  @Column({ type: 'jsonb', default: [] }) features!: string[];
  @Column({ default: '' }) location!: string;
  @Column({ default: 'USED' }) condition!: 'NEW' | 'USED' | 'IMPORTED';
  @Column({ default: 'AVAILABLE' }) status!: 'DRAFT' | 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'IN_TRANSIT' | 'COMING_SOON' | 'UNAVAILABLE';
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'text', default: '' }) aiSalesCopy!: string;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
}

@Entity('commerce_vehicle_media')
@Index(['vehicleId', 'sortOrder'])
export class VehicleMedia extends BaseEntity {
  @Column('uuid') vehicleId!: string;
  @Column() url!: string;
  @Column({ default: 'IMAGE' }) kind!: 'IMAGE' | 'VIDEO';
  @Column({ type: 'int', default: 0 }) sortOrder!: number;
  // Photos uploaded from the dealer app are stored inline (like product media)
  // and served through /commerce-public/media/:token, so a dealer never needs a
  // separate image host to publish a car to Jumla.
  @Index({ unique: true }) @Column({ nullable: true, type: 'varchar' }) publicToken?: string | null;
  @Column({ nullable: true, type: 'varchar' }) mimeType?: string | null;
  @Column({ type: 'bytea', nullable: true }) contentBinary?: Buffer | null;
}

@Entity('commerce_vehicle_listing_metadata')
@Index(['vehicleId'], { unique: true })
export class VehicleListingMetadata extends BaseEntity {
  @Column('uuid') vehicleId!: string;
  @Column({ type: 'jsonb', default: [] }) highlights!: string[];
  @Column({ type: 'jsonb', default: [] }) keywords!: string[];
  @Column({ default: '' }) socialCaption!: string;
  @Column({ default: '' }) verticalVideoUrl!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) purchaseCost!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) dutyCost!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) clearingCost!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) transportCost!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) repairCost!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) advertisingCost!: number;
}

@Entity('commerce_vehicle_buyer_requests')
@Index(['vehicleId', 'createdAt'])
export class VehicleBuyerRequest extends BaseEntity {
  @Column('uuid') vehicleId!: string;
  @Column('uuid') businessId!: string;
  @Column() customerName!: string;
  @Column() customerPhone!: string;
  @Column({ default: '' }) customerWhatsapp!: string;
  @Column({ default: 'OUTRIGHT' }) requestType!: 'OUTRIGHT' | 'RESERVE' | 'FINANCE';
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true }) offerAmount?: number | null;
  @Column({ default: 'PHONE' }) preferredContact!: 'PHONE' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  @Column({ type: 'text', default: '' }) tradeInDetails!: string;
  @Column({ type: 'text', default: '' }) message!: string;
  @Column({ default: '' }) customerEmail!: string;
  @Index() @Column('uuid', { nullable: true }) crmLeadId?: string | null;
  @Column({ default: 'NEW' }) status!: 'NEW' | 'CONTACTED' | 'CLOSED';
}

@Entity('commerce_vehicle_reservations')
@Index(['reservationCode'], { unique: true })
export class VehicleReservation extends BaseEntity {
  @Column('uuid') vehicleId!: string;
  @Column('uuid') businessId!: string;
  @Column() reservationCode!: string;
  @Column() customerName!: string;
  @Column() customerPhone!: string;
  @Column({ default: 'HELD' }) status!: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | 'CONVERTED';
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Index() @Column('uuid', { nullable: true }) crmLeadId?: string | null;
  @Column({ type: 'timestamptz', nullable: true }) confirmedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) convertedAt?: Date | null;
}

@Entity('commerce_vehicle_appointments')
@Index(['businessId', 'scheduledFor'])
@Index(['vehicleId', 'scheduledFor'])
export class VehicleAppointment extends BaseEntity {
  @Column('uuid') vehicleId!: string;
  @Column('uuid') businessId!: string;
  @Column() customerName!: string;
  @Column() customerPhone!: string;
  @Column({ default: '' }) customerWhatsapp!: string;
  @Column({ default: '' }) customerEmail!: string;
  @Column({ default: 'SHOWROOM' }) appointmentType!: 'SHOWROOM' | 'TEST_DRIVE';
  @Column({ type: 'timestamptz' }) scheduledFor!: Date;
  @Column({ default: '' }) showroomLocation!: string;
  @Column({ default: '' }) salesperson!: string;
  @Column({ default: 'REQUESTED' }) status!: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  @Column({ type: 'text', default: '' }) message!: string;
  @Index() @Column('uuid', { nullable: true }) crmLeadId?: string | null;
}

export const CAR_ENTITIES = [CommerceVehicle, VehicleMedia, VehicleListingMetadata, VehicleBuyerRequest, VehicleReservation, VehicleAppointment] as const;
