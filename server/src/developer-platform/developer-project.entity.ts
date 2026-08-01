import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('developer_projects')
@Index(['userId', 'slug'], { unique: true })
export class DeveloperProject extends BaseEntity {
  @Index()
  @Column('uuid')
  userId!: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Index({ unique: true })
  @Column()
  apiKeyHash!: string;

  @Column()
  apiKeyPrefix!: string;

  @Column({ type: 'jsonb', default: [] })
  allowedOrigins!: string[];

  @Column({ default: 'active' })
  status!: 'active' | 'suspended';

  @Column({ type: 'int', default: 0 })
  usageCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;
}
