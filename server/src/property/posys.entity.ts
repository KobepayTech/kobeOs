import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * POSys 6-digit payment token a tenant generates from their app and a
 * cashier / cargo-office agent enters into theirs. Roams across the
 * tenant's devices because the token lives in the database, not in
 * localStorage on the issuing device.
 *
 * `code` is unique per active token (regenerated on collision). PINs
 * are intentionally absent — this is a low-stakes "verify amount +
 * tenant" code, not a transactional secret. The amount is what the
 * tenant claims to pay; the agent records the actual amount received
 * when redeeming, which closes the loop.
 */
@Entity('property_payment_tokens')
@Index(['ownerId', 'status'])
export class PropertyPaymentToken extends OwnedEntity {
  @Index({ unique: true })
  @Column({ length: 8 })
  code!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid', { nullable: true })
  unitId?: string | null;

  @Column('uuid', { nullable: true })
  leaseId?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: 'ACTIVE' })
  status!: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  usedAmount!: number;

  @Column('uuid', { nullable: true })
  agentId?: string | null;
}
