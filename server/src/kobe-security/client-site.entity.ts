import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('client_sites')
export class ClientSite extends OwnedEntity {
  @Index()
  @Column('uuid')
  clientId!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  address!: string;

  @Column({ default: 'standard' })
  plan!: string;

  @Column({ type: 'simple-array', default: '' })
  zoneIds!: string[];
}
