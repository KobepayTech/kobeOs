import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('service_checks')
export class ServiceCheck extends OwnedEntity {
  @Index()
  @Column('uuid')
  routeId!: string;

  @Index()
  @Column('uuid')
  memberId!: string;

  @Column()
  checkpointName!: string;

  @Column({ default: 'checked' })
  status!: 'checked' | 'missed' | 'late';

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  checkedAt!: Date;

  @Column({ nullable: true, type: 'varchar' })
  note?: string | null;
}
