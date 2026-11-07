import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type AgentExecutionStatus = 'ok' | 'error';

/**
 * One tool call made by the assistant on a user's behalf.
 *
 * KobeOS recorded runs for *scheduled* agents (AiAgentRun, keyed by a
 * scheduled agentId) but nothing for the interactive assistant, so there was
 * no way to answer "what did it actually do", "which tools fail", or "why was
 * that slow". This is the execution record the monitor reads.
 *
 * Arguments are deliberately not stored: they routinely carry customer names,
 * phone numbers and amounts, and none of that is needed to monitor tool
 * health. Only the shape of the call is kept.
 */
@Entity('ai_agent_executions')
export class AiAgentExecution extends BaseEntity {
  @Index('IDX_ai_agent_exec_owner')
  @Column('uuid')
  ownerId!: string;

  @Column()
  tool!: string;

  @Column({ type: 'varchar', length: 16, default: 'ok' })
  status!: AgentExecutionStatus;

  @Index('IDX_ai_agent_exec_started')
  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'int', default: 0 })
  durationMs!: number;

  /** Served from the in-process tool cache rather than actually run. */
  @Column({ default: false })
  cached!: boolean;

  /** A tool that changes data, as opposed to a read. */
  @Column({ default: false })
  write!: boolean;

  @Column({ type: 'text', default: '' })
  error!: string;
}
