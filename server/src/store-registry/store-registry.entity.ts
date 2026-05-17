import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type RegistrationStatus = 'active' | 'inactive' | 'suspended';

/**
 * One record per published store.
 * Tracks which subdomain belongs to which KobeOS instance (identified by IP).
 */
@Entity('store_registrations')
export class StoreRegistration extends BaseEntity {
  /** The claimed subdomain label, e.g. "kelvinfashion" */
  @Index({ unique: true })
  @Column()
  slug!: string;

  /** Public IP of the KobeOS instance serving this store */
  @Column()
  serverIp!: string;

  /** Port the KobeOS API listens on (default 3000) */
  @Column({ default: 3000 })
  serverPort!: number;

  /** Cloudflare DNS record ID — needed to update/delete the A record */
  @Column({ nullable: true, type: 'varchar' })
  cfRecordId!: string | null;

  @Column({ default: 'active' })
  status!: RegistrationStatus;

  /** Last time the KobeOS instance sent a heartbeat */
  @Column({ nullable: true, type: 'timestamptz' })
  lastSeenAt!: Date | null;

  /** Owner identifier from the KobeOS instance (JWT sub) */
  @Column()
  ownerId!: string;

  /** Human-readable store name for the registry dashboard */
  @Column({ default: '' })
  storeName!: string;
}
