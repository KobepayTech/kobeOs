import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('service_routes')
export class ServiceRoute extends OwnedEntity {
  @Index()
  @Column('uuid')
  siteId!: string;

  @Column()
  name!: string;

  @Column({ type: 'simple-array', default: '' })
  checkpointNames!: string[];

  @Column({ default: true })
  active!: boolean;
}
