import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/** Workspace scope includes ALL records owned by an account, not one shop. */
@Entity('business_workspace_members')
@Index('UQ_business_workspace_member', ['ownerId', 'memberId'], { unique: true })
export class WorkspaceMember extends OwnedEntity {
  @Column('uuid') memberId!: string;
  @Column({ default: 'viewer' }) role!: 'viewer';
  @Column({ default: 'INVITED' }) status!: 'INVITED' | 'ACTIVE' | 'REVOKED';
  @Column({ type: 'timestamptz', nullable: true }) acceptedAt?: Date | null;
}
