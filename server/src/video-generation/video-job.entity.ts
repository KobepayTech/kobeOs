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

  @Column({ nullable: true })
  topic?: string;

  @Column({ type: 'text', nullable: true })
  script?: string | null;

  @Column({ default: 'pending' })
  status!: 'pending' | 'scripting' | 'generating_images' | 'synthesizing_voice' | 'compositing' | 'completed' | 'failed';

  @Column({ nullable: true })
  errorMessage?: string | null;

  @Column({ nullable: true })
  outputPath?: string | null;

  @Column({ nullable: true })
  outputUrl?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  progress?: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  progressPercent!: number;

  @Column({ default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ nullable: true })
  completedAt?: Date | null;
}
