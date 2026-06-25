import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Kobe Token — portable cash-payout voucher that two KobePay offices
 * (TZ ↔ China, or two TZ offices) can verify without phoning each
 * other. The customer is given the 6-char `code` + a 4-digit PIN
 * (the PIN is hashed here, never stored plain). The redeeming office
 * scans the code, presents the PIN, gets a PAID receipt.
 *
 * Not OwnedEntity: tokens are not tenant-scoped — both the issuing
 * and the redeeming office may belong to different KobePay tenants
 * (e.g. TZ retail and China supplier offices) and must both see the
 * same token row. issuedOwnerId / paidOwnerId record which tenant
 * each side belongs to for audit + commission accounting.
 */
@Entity('kobe_tokens')
export class KobeToken extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 16 })
  code!: string;                              // KOB-XXXXXX

  /** PIN hash — sha256(pin + salt). Salt is per-token (the random
   *  prefix on the hash). Plain PIN never persists. */
  @Column({ length: 128 })
  pinHash!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount!: number;

  @Column({ length: 8, default: 'TZS' })
  currency!: string;

  @Column({ length: 200 })
  senderName!: string;

  @Column({ length: 40, default: '' })
  senderPhone!: string;

  @Column({ length: 200 })
  receiverName!: string;

  @Column({ length: 40, default: '' })
  receiverPhone!: string;

  @Column({ type: 'text', default: '' })
  purpose!: string;

  /** Office / agent name the customer was told to use when picking
   *  up. Free-string so both "Cashworld Wakala" (TZ) and "Guangzhou
   *  Office" (China) work without enumerating every location. */
  @Column({ length: 200, default: '' })
  agent!: string;

  @Index()
  @Column({ length: 16, default: 'PENDING' })
  status!: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';

  /** Tenant that issued the token (KobePay TZ owner). Null when
   *  issued anonymously via the public /tuma page. */
  @Index()
  @Column('uuid', { nullable: true })
  issuedOwnerId?: string | null;

  @Column({ length: 200, default: '' })
  issuedByName!: string;

  /** Tenant that redeemed the token (KobePay China or different TZ
   *  owner). Null until paid. */
  @Index()
  @Column('uuid', { nullable: true })
  paidOwnerId?: string | null;

  @Column({ length: 200, default: '' })
  paidByName!: string;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;
}
