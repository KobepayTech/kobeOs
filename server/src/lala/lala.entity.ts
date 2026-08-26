import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

@Entity('lala_hotel_profiles')
@Index(['ownerId', 'hotelId'], { unique: true })
export class LalaHotelProfile extends OwnedEntity {
  @Column('uuid') hotelId!: string;
  @Column({ default: false }) listed!: boolean;
  // Explicit opt-OUT from the public Lala network. Every hotel with bookable
  // rooms appears on Lala by default; an owner sets this to hide theirs.
  @Column({ default: false }) hiddenFromLala!: boolean;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'float', default: 0 }) starRating!: number;
  @Column({ type: 'jsonb', default: [] }) amenities!: string[];
  @Column({ type: 'jsonb', default: [] }) images!: string[];
  @Column({ default: '' }) latitude!: string;
  @Column({ default: '' }) longitude!: string;
  @Column({ type: 'jsonb', default: {} }) policies!: Record<string, unknown>;
  @Column({ default: true }) lastMinuteEnabled!: boolean;
  @Column({ default: true }) reverseOffersEnabled!: boolean;
  @Column({ type: 'float', default: 0 }) guestRating!: number;
  @Column({ type: 'int', default: 0 }) verifiedReviewCount!: number;
}

@Entity('lala_room_types')
@Index(['ownerId', 'hotelId', 'name'], { unique: true })
export class LalaRoomType extends OwnedEntity {
  @Column('uuid') hotelId!: string;
  @Column() name!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'int', default: 2 }) capacity!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) baseRate!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'jsonb', default: [] }) amenities!: string[];
  @Column({ type: 'jsonb', default: [] }) images!: string[];
  @Column({ default: true }) active!: boolean;
}

@Entity('lala_room_inventory')
@Index(['hotelId', 'roomTypeId', 'stayDate'], { unique: true })
export class LalaRoomInventory extends BaseEntity {
  @Column('uuid') hotelId!: string;
  @Column('uuid') roomTypeId!: string;
  @Column({ type: 'date' }) stayDate!: string;
  @Column({ type: 'int', default: 0 }) availableRooms!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) rate!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: 'KOBEOS' }) source!: 'KOBEOS' | 'CHANNEL' | 'MANUAL';
  @Column({ type: 'timestamptz' }) verifiedAt!: Date;
}

@Entity('lala_passports')
@Index(['phone'], { unique: true })
@Index(['qrToken'], { unique: true })
export class LalaPassport extends BaseEntity {
  @Column() passportNumber!: string;
  @Column() qrToken!: string;
  @Column() phone!: string;
  @Column() name!: string;
  @Column({ default: '' }) email!: string;
  @Column({ default: '' }) nationality!: string;
  @Column({ type: 'jsonb', default: {} }) preferences!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: { shareName: true, sharePhone: true, shareHistory: false } }) privacy!: Record<string, boolean>;
  @Column({ default: true }) active!: boolean;
}

@Entity('lala_guest_folios')
@Index(['bookingId'], { unique: true })
export class LalaGuestFolio extends BaseEntity {
  @Column('uuid') bookingId!: string;
  @Column('uuid') hotelId!: string;
  @Column('uuid') passportId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) roomCharges!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) foodCharges!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) otherCharges!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) payments!: number;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'CLOSED';
}

@Entity('lala_hotel_loyalty_programs')
@Index(['ownerId', 'hotelId'], { unique: true })
export class HotelLoyaltyProgram extends OwnedEntity {
  @Column('uuid') hotelId!: string;
  @Column({ default: 'Hotel Loyalty' }) name!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ default: 'POINTS' }) programType!: 'POINTS' | 'STAMP_CARD' | 'MEMBERSHIP_TIERS' | 'CASHBACK' | 'FREE_NIGHTS' | 'PAID_VIP' | 'CORPORATE';
  @Column({ type: 'decimal', precision: 12, scale: 4, default: 1 }) pointsPerCurrencyUnit!: number;
  @Column({ type: 'int', default: 0 }) welcomePoints!: number;
  @Column({ type: 'int', default: 365 }) expiryDays!: number;
  @Column({ type: 'jsonb', default: {} }) eligibility!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: [] }) tiers!: Array<{ name: string; minimumPoints: number; benefits: string[] }>;
  @Column({ type: 'jsonb', default: [] }) rewards!: Array<{ name: string; points: number; description: string }>;
}

@Entity('lala_hotel_loyalty_accounts')
@Index(['hotelId', 'passportId'], { unique: true })
export class HotelLoyaltyAccount extends BaseEntity {
  @Column('uuid') hotelId!: string;
  @Column('uuid') passportId!: string;
  @Column({ type: 'int', default: 0 }) points!: number;
  @Column({ default: 'Member' }) tier!: string;
  @Column({ type: 'int', default: 0 }) stays!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) lifetimeSpend!: number;
}

@Entity('lala_rewards_accounts')
@Index(['passportId'], { unique: true })
export class LalaRewardsAccount extends BaseEntity {
  @Column('uuid') passportId!: string;
  @Column({ type: 'int', default: 0 }) points!: number;
  @Column({ default: 'Explorer' }) tier!: string;
  @Column({ type: 'int', default: 0 }) verifiedStays!: number;
}

@Entity('lala_verified_stays')
@Index(['bookingId'], { unique: true })
export class VerifiedStay extends BaseEntity {
  @Column('uuid') bookingId!: string;
  @Column('uuid') hotelId!: string;
  @Column('uuid') passportId!: string;
  @Column({ type: 'date' }) checkIn!: string;
  @Column({ type: 'date' }) checkOut!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) eligibleSpend!: number;
  @Column({ type: 'int', default: 0 }) hotelPointsEarned!: number;
  @Column({ type: 'int', default: 0 }) lalaPointsEarned!: number;
  @Column({ default: true }) reviewEligible!: boolean;
}

@Entity('lala_reviews')
@Index(['verifiedStayId'], { unique: true })
export class LalaReview extends BaseEntity {
  @Column('uuid') verifiedStayId!: string;
  @Column('uuid') hotelId!: string;
  @Column('uuid') passportId!: string;
  @Column({ type: 'int' }) rating!: number;
  @Column({ type: 'text', default: '' }) comment!: string;
  @Column({ default: true }) verified!: boolean;
}

@Entity('lala_reverse_requests')
@Index(['status', 'checkIn'])
export class LalaReverseRequest extends BaseEntity {
  @Column('uuid') passportId!: string;
  @Column() destination!: string;
  @Column({ type: 'date' }) checkIn!: string;
  @Column({ type: 'date' }) checkOut!: string;
  @Column({ type: 'int', default: 1 }) guests!: number;
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) budget!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
}

@Entity('lala_hotel_offers')
@Index(['requestId', 'hotelId'], { unique: true })
export class LalaHotelOffer extends OwnedEntity {
  @Column('uuid') requestId!: string;
  @Column('uuid') hotelId!: string;
  @Column('uuid') roomId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2 }) totalPrice!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'text', default: '' }) message!: string;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ default: 'ACTIVE' }) status!: 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'WITHDRAWN';
}

@Entity('lala_corporate_accounts')
export class LalaCorporateAccount extends BaseEntity {
  @Column() name!: string;
  @Column({ default: '' }) contactName!: string;
  @Column({ default: '' }) phone!: string;
  @Column({ default: '' }) email!: string;
  @Column({ default: 'CORPORATE' }) type!: 'CORPORATE' | 'AGENT';
  @Column({ default: 'ACTIVE' }) status!: 'ACTIVE' | 'SUSPENDED';
}

@Entity('lala_group_booking_requests')
export class LalaGroupBookingRequest extends BaseEntity {
  @Column({ type: 'uuid', nullable: true }) corporateAccountId?: string | null;
  @Column() destination!: string;
  @Column({ type: 'date' }) checkIn!: string;
  @Column({ type: 'date' }) checkOut!: string;
  @Column({ type: 'int' }) rooms!: number;
  @Column({ type: 'int' }) guests!: number;
  @Column({ default: 'OPEN' }) status!: 'OPEN' | 'QUOTED' | 'CONFIRMED' | 'CANCELLED';
}

export const LALA_ENTITIES = [
  LalaHotelProfile, LalaRoomType, LalaRoomInventory, LalaPassport, LalaGuestFolio,
  HotelLoyaltyProgram, HotelLoyaltyAccount, LalaRewardsAccount, VerifiedStay, LalaReview,
  LalaReverseRequest, LalaHotelOffer, LalaCorporateAccount, LalaGroupBookingRequest,
] as const;
