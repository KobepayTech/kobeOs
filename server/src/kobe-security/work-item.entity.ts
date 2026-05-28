import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('work_items')
export class WorkItem extends OwnedEntity {
  @Index()
  @Column({ nullable: true, type: 'uuid' })
  clientId?: string | null;

  @Index()
  @Column({ nullable: true, type: 'uuid' })
  siteId?: string | null;

  @Column()
  title!: string;

  @Column({ default: 'normal' })
  priority!: string;

  @Column({ default: 'open' })
  state!: string;

  @Column({ default: '' })
  details!: string;
}
