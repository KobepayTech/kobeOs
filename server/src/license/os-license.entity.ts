import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type OsLicensePlan = 'trial' | 'pro';
export type OsLicenseStatus = 'pending' | 'active' | 'expired' | 'failed';

/** Monthly price in TZS per plan */
export const OS_LICENSE_PRICES: Record<OsLicensePlan, number> = {
  trial: 2_000,
  pro:   10_000,
};

@Entity('os_licenses')
export class OsLicense extends BaseEntity {
  @Index()
  @Column('uuid')
  userId!: string;

  @Column({ default: 'trial' })
  plan!: OsLicensePlan;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amountTzs!: number;

  /** Internal transaction ID sent to PalmPesa */
  @Index({ unique: true })
  @Column()
  transactionId!: string;

  /** PalmPesa order_id returned on initiation */
  @Column({ nullable: true, type: 'varchar' })
  palmPesaOrderId?: string | null;

  /** PalmPesa transid from the callback */
  @Column({ nullable: true, type: 'varchar' })
  palmPesaTransId?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  channel?: string | null;

  @Index()
  @Column({ default: 'pending' })
  status!: OsLicenseStatus;

  /** Signed license token issued to the client on activation */
  @Column({ nullable: true, type: 'text' })
  licenseToken?: string | null;

  /** When this license period expires (30 days after activation) */
  @Column({ nullable: true, type: 'timestamptz' })
  expiresAt?: Date | null;

  /** Raw PalmPesa callback payload for audit */
  @Column({ type: 'jsonb', nullable: true })
  callbackPayload?: Record<string, unknown> | null;
}
