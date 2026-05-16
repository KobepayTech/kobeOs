import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  action!: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'TRANSFER' | 'RESET_PASSWORD';

  @Column()
  entityType!: string;

  @Column({ nullable: true })
  entityId?: string | null;

  @Column({ nullable: true })
  userId?: string | null;

  @Column({ nullable: true })
  userEmail?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValue?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValue?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ default: () => 'NOW()' })
  createdAt!: Date;
}
