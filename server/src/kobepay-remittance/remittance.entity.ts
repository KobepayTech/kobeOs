import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

// pg returns numeric/decimal as string; coerce to number on read.
const numeric = {
  to: (v: number | string) => v,
  from: (v: string | number | null | undefined) => (v == null ? 0 : Number(v)),
};

/**
 * A cross-border remittance CLAIM. Created from a receive-receipt: money is
 * waiting to be cashed out at the destination. `balance` is the single shared
 * pool that the master QR AND every supplier QR draw down — no combination of
 * redemptions can ever exceed it (enforced with a row lock + idempotency).
 *
 * `ownerId` is the cashier company / KobePay operator holding the funds. The
 * sender is identified by name/phone and manages the claim through a secret
 * `portalToken` (their live-balance webpage); `masterCode` is the primary QR.
 */
@Entity('remittance_claims')
@Index(['ownerId', 'status'])
export class RemittanceClaim extends OwnedEntity {
  @Index({ unique: true })
  @Column({ length: 8 })
  masterCode!: string;

  /** Secret for the sender's live portal page (not shown to the cashier). */
  @Index({ unique: true })
  @Column()
  portalToken!: string;

  @Column({ default: '' })
  senderName!: string;

  @Column({ default: '' })
  senderPhone!: string;

  @Column({ default: '' })
  recipientCountry!: string;

  @Column({ default: 'USD' })
  currency!: string;

  /** Original amount received. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  amount!: number;

  /** Remaining, un-cashed-out balance — the shared pool. */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  balance!: number;

  @Column({ default: 'OPEN' })
  status!: 'OPEN' | 'SETTLED' | 'CANCELLED';
}

/**
 * A supplier's child QR against a claim. Carries a FIXED `authorizedAmount` cap
 * so a lost/leaked supplier QR can only ever cost that much, and multiple
 * suppliers can split one claim. `code` is the QR the cashier scans; it draws
 * from the parent claim's shared balance exactly like the master QR.
 */
@Entity('remittance_supplier_qrs')
@Index(['ownerId', 'claimId'])
export class RemittanceSupplierQr extends OwnedEntity {
  @Column('uuid')
  claimId!: string;

  @Index({ unique: true })
  @Column({ length: 8 })
  code!: string;

  @Column({ default: '' })
  supplierName!: string;

  @Column({ default: '' })
  supplierPhone!: string;

  /** Fixed cap this supplier may cash out (≤ claim balance still applies). */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  authorizedAmount!: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  redeemedAmount!: number;

  @Column({ default: 'ACTIVE' })
  status!: 'ACTIVE' | 'USED' | 'CANCELLED';

  /** Idempotency keys already applied against this QR. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  redeemedKeys!: string[];
}

/** Immutable ledger of every cash-out against a claim (master or a supplier). */
@Entity('remittance_payouts')
@Index(['ownerId', 'claimId'])
export class RemittancePayout extends OwnedEntity {
  @Column('uuid')
  claimId!: string;

  /** null = paid against the master QR; else the supplier QR id. */
  @Column('uuid', { nullable: true })
  supplierQrId?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0, transformer: numeric })
  amount!: number;

  @Column({ default: '' })
  cashierId!: string;

  @Column({ default: '' })
  idempotencyKey!: string;
}
