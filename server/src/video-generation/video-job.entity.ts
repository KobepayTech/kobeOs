import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('video_jobs')
@Index(['ownerId', 'createdAt'])
export class VideoJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  ownerId!: string;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  topic?: string;

  @Column({ type: 'text', nullable: true })
  script?: string | null;

  @Column({ default: 'pending' })
  status!: 'pending' | 'scripting' | 'generating_images' | 'synthesizing_voice' | 'compositing' | 'completed' | 'failed';

  @Column({ type: 'varchar', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'varchar', nullable: true })
  outputPath?: string | null;

  @Column({ type: 'varchar', nullable: true })
  outputUrl?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  progress?: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  progressPercent!: number;

  @Column({ default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
