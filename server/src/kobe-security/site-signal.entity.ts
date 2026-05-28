import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('site_signals')
export class SiteSignal extends OwnedEntity {
  @Index()
  @Column({ nullable: true, type: 'uuid' })
  siteId?: string | null;

  @Index()
  @Column()
  zoneId!: string;

  @Column()
  zoneName!: string;

  @Column({ default: 'signal' })
  eventType!: string;

  @Column({ default: 'info' })
  severity!: 'info' | 'warning' | 'critical';

  @Column({ default: false })
  occupied!: boolean;

  @Column({ default: 0 })
  peopleCount!: number;

  @Column({ type: 'float', default: 0 })
  confidence!: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  raw!: Record<string, unknown>;
}
