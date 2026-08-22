import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type AgentFrequency = 'HOURLY' | 'DAILY' | 'WEEKLY';
export type AgentApprovalMode = 'AUTOMATIC' | 'APPROVAL_REQUIRED' | 'DRAFT_ONLY';
export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'RUNNING' | 'ERROR';
export type AgentRunStatus = 'RUNNING' | 'SUCCEEDED' | 'AWAITING_APPROVAL' | 'FAILED' | 'SKIPPED';

@Entity('ai_scheduled_agents')
@Index(['ownerId', 'status', 'nextRunAt'])
export class AiScheduledAgent extends OwnedEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ type: 'text' })
  objective!: string;

  @Column({ default: 'DAILY' })
  frequency!: AgentFrequency;

  /** HH:mm in the agent's timezone for DAILY/WEEKLY. */
  @Column({ default: '08:00' })
  timeOfDay!: string;

  /** 1..168; used only for HOURLY. */
  @Column({ type: 'int', default: 24 })
  intervalHours!: number;

  /** 0=Sunday ... 6=Saturday; used only for WEEKLY. */
  @Column({ type: 'simple-json', default: '[]' })
  daysOfWeek!: number[];

  @Column({ default: 'Africa/Dar_es_Salaam' })
  timezone!: string;

  @Column({ type: 'simple-json', default: '[]' })
  allowedModules!: string[];

  @Column({ type: 'simple-json', default: '[]' })
  allowedTools!: string[];

  @Column({ default: 'APPROVAL_REQUIRED' })
  approvalMode!: AgentApprovalMode;

  @Column({ type: 'simple-json', default: '[]' })
  inputSources!: string[];

  @Column({ default: 'KOBEOS_INBOX' })
  outputDestination!: 'KOBEOS_INBOX' | 'SMS_OWNER' | 'DRAFT_ONLY';

  @Column({ default: 'ACTIVE' })
  status!: AgentStatus;

  @Column({ type: 'timestamptz' })
  nextRunAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSuccessAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  leaseUntil?: Date | null;

  @Column({ default: 0 })
  consecutiveFailures!: number;

  @Column({ default: '' })
  lastError!: string;
}

@Entity('ai_agent_runs')
@Index(['ownerId', 'agentId', 'startedAt'])
@Index(['ownerId', 'status'])
export class AiAgentRun extends OwnedEntity {
  @Column('uuid')
  agentId!: string;

  @Column({ default: 'RUNNING' })
  status!: AgentRunStatus;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Column({ type: 'jsonb', default: {} })
  result!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  pendingAction?: { tool: string; summary: string; args: Record<string, unknown> } | null;

  @Column({ default: '' })
  error!: string;

  @Column({ default: false })
  wasAutomaticAction!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt?: Date | null;
}
