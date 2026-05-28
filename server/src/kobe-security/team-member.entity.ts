import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('team_members')
export class TeamMember extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ nullable: true, type: 'varchar' })
  phone?: string | null;

  @Column({ default: 'active' })
  status!: 'active' | 'inactive' | 'suspended';

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  assignedSiteId?: string | null;
}
