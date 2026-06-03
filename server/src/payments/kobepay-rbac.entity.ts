import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type KobePayRole = 'Admin' | 'Manager' | 'Cashier TZ' | 'Cashier China' | 'Auditor';

/**
 * KobePay sub-users. The KobeOS account owner (one per business) owns
 * a list of these — each cashier on the floor is a sub-user, not a
 * separate KobeOS account. The 4-digit pin is what cashiers type at
 * the till to authenticate their actions; it's owner-scoped so two
 * different businesses can both use pin '1234' without collision.
 */
@Entity('kobepay_users')
@Index(['ownerId', 'pin'], { unique: true })
export class KobePayUser extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ default: 'Cashier TZ' })
  role!: KobePayRole;

  @Column({ default: true })
  active!: boolean;

  /** 4-digit till pin. Unique per owner so two businesses can share a pin space. */
  @Column({ default: '0000' })
  pin!: string;

  /**
   * Optional per-user permission overrides. The role grants a default
   * permission set; entries here flip individual capabilities on/off
   * regardless of role. Empty/absent = use role defaults.
   */
  @Column({ type: 'simple-json', nullable: true })
  permissions?: Record<string, boolean> | null;
}

/**
 * Append-only audit log for every mutating KobePay action. Lets the
 * owner answer "who did this, when, and what data did they touch?"
 * Used by the Risk dashboard to flag rate overrides, reversals, and
 * cashier mismatches.
 */
@Entity('kobepay_audit_events')
export class KobePayAuditEvent extends OwnedEntity {
  @Index()
  @Column('uuid', { nullable: true })
  actorUserId?: string | null;

  @Column({ default: '' })
  actorName!: string;

  @Column({ default: '' })
  actorRole!: string;

  /** Verb-dot-noun action key, e.g. 'deposit.create', 'payout.advance'. */
  @Index()
  @Column()
  action!: string;

  @Column({ default: '' })
  resourceType!: string;

  @Index()
  @Column('uuid', { nullable: true })
  resourceId?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown> | null;
}
