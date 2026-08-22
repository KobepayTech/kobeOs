import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Per-hotel wallet for the central-platform settlement model. When guests
 * pay for rooms through the shared KobePay/PalmPesa merchant, the money
 * pools in the platform account; this wallet is the running balance the
 * platform OWES each hotel (net of commission). One row per hotel account
 * (ownerId) — different hotel businesses have different ownerIds, so their
 * balances can never mix.
 */
@Entity('hotel_wallets')
// Explicit name so this unique index doesn't collide with the non-unique
// ownerId index inherited from OwnedEntity (TypeORM auto-names both from the
// same table+columns hash, which would clash on synchronize).
@Index('UQ_hotel_wallet_owner', ['ownerId'], { unique: true })
export class HotelWallet extends OwnedEntity {
  /** Current withdrawable balance (net of commission and past payouts). */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  /** Lifetime gross earned (before commission) and total disbursed. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalEarned!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalCommission!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalPaidOut!: number;

  /** Optional per-hotel commission override (percent, e.g. 8.5). Null =
   *  use the platform default from HOTEL_PLATFORM_COMMISSION_PCT. */
  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  commissionRatePct?: number | null;
}

export type HotelWalletTxnType = 'CREDIT' | 'COMMISSION' | 'PAYOUT' | 'REVERSAL';

@Entity('hotel_wallet_txns')
@Index(['ownerId', 'createdAt'])
export class HotelWalletTxn extends OwnedEntity {
  @Column()
  type!: HotelWalletTxnType;

  /** Signed effect on balance: CREDIT positive, PAYOUT/COMMISSION negative
   *  relative to gross. Stored as the absolute amount; `direction` gives sign. */
  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount!: number;

  @Column({ default: 'credit' })
  direction!: 'credit' | 'debit';

  @Column({ default: 'TZS' })
  currency!: string;

  /** Wallet balance immediately after this entry — an audit trail. */
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balanceAfter!: number;

  @Index()
  @Column('uuid', { nullable: true })
  bookingId?: string | null;

  @Index()
  @Column('uuid', { nullable: true })
  payoutId?: string | null;

  @Column('uuid', { nullable: true })
  hotelId?: string | null;

  @Column({ type: 'text', default: '' })
  description!: string;
}

export type HotelPayoutStatus = 'PENDING' | 'PAID' | 'FAILED';

@Entity('hotel_payouts')
@Index(['ownerId', 'status'])
export class HotelPayout extends OwnedEntity {
  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  /** How the platform disburses to the hotel. */
  @Column({ default: 'MobileMoney' })
  method!: 'MobileMoney' | 'Bank' | 'Cash' | 'Other';

  /** Destination — phone number for mobile money, or account details. */
  @Column({ default: '' })
  destination!: string;

  @Column({ default: 'PENDING' })
  status!: HotelPayoutStatus;

  @Column({ default: '' })
  reference!: string;

  @Column({ default: '' })
  requestedByName!: string;

  @Column({ default: '' })
  processedByName!: string;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'text', default: '' })
  notes!: string;
}
