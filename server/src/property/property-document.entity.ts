import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/** Leases, IDs, insurance, inspection reports, etc. The file itself lives in
 *  media/files storage; this row is the metadata + link. */
@Entity('property_documents')
@Index(['ownerId', 'type'])
export class PropertyDocument extends OwnedEntity {
  @Column() name!: string;
  @Column({ default: 'other' }) type!: string; // lease | id | insurance | inspection | receipt | other
  @Column({ default: '' }) url!: string;
  @Column({ nullable: true, type: 'varchar' }) mimeType?: string | null;
  @Column({ type: 'bigint', default: 0 }) sizeBytes!: number;
  @Column({ type: 'uuid', nullable: true }) propertyId?: string | null;
  @Column({ type: 'uuid', nullable: true }) unitId?: string | null;
  @Column({ type: 'uuid', nullable: true }) tenantId?: string | null;
  @Column({ default: '' }) notes!: string;
}
