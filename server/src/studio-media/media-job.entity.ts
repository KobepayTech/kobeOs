import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('studio_media_jobs')
export class StudioMediaJob extends OwnedEntity {
  @Index()
  @Column('uuid')
  projectId!: string;

  @Column({ default: 'queued' })
  status!: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  @Column({ default: 'MoneyPrinterTurbo' })
  engine!: string;

  @Column({ default: '' })
  requestPayload!: string;

  @Column({ default: '' })
  resultPayload!: string;

  @Column({ nullable: true, type: 'varchar' })
  outputUrl?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  errorMessage?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
