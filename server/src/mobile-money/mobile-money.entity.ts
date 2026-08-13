import { Column, Entity, Index, Unique } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import type { SmsDirection, SmsProvider } from './payment-sms-parser';

const numeric = {
  to: (v: number) => v,
  from: (v: string | null) => (v == null ? 0 : parseFloat(v)),
};

export type InboundStatus = 'RECEIVED' | 'IGNORED' | 'DUPLICATE' | 'PROCESSED' | 'FAILED';

/**
 * A registered SMS-forwarder device (typically a school/branch iPhone running
 * the Shortcuts automation). `deviceId` + gateway key authenticate the bridge
 * and resolve which owner to credit and which consumer to route to.
 */
@Entity('mm_sms_devices')
@Unique('UQ_mm_device_id', ['deviceId'])
export class SmsDevice extends OwnedEntity {
  @Column() deviceId!: string;
  @Column({ default: '' }) label!: string;
  /** sha256 of the shared gateway key — the plain key is never stored. */
  @Column() gatewayKeyHash!: string;
  /** Which consumer handles this device's transactions (e.g. 'kobepay-pro'). */
  @Column({ default: 'general' }) purpose!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt?: Date | null;
}

/**
 * Every inbound mobile-money/bank transaction the bridge forwards. This is the
 * shared, deduped, queryable inbox any module can build on. Unique on
 * (ownerId, transactionId) so a re-forwarded SMS never processes twice.
 */
@Entity('mm_inbound_payments')
@Unique('UQ_mm_inbound_txn', ['ownerId', 'transactionId'])
@Index(['ownerId', 'status', 'createdAt'])
export class InboundPayment extends OwnedEntity {
  @Column({ default: '' }) deviceId!: string;
  @Column() transactionId!: string;
  @Column({ default: 'UNKNOWN' }) provider!: SmsProvider;
  @Column({ default: 'UNKNOWN' }) direction!: SmsDirection;
  @Column('numeric', { precision: 18, scale: 4, default: 0, transformer: numeric }) amount!: number;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ default: '' }) senderName!: string;
  @Column({ default: '' }) senderPhone!: string;
  @Column({ default: '' }) reference!: string;
  @Column({ default: '' }) account!: string;
  @Column({ default: 'RECEIVED' }) status!: InboundStatus;
  /** Which consumer claimed it, and its own reference (e.g. a deposit id). */
  @Column({ default: '' }) consumedBy!: string;
  @Column({ default: '' }) consumedRef!: string;
  @Column({ type: 'text', default: '' }) rawMessage!: string;
}
