import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type AiWorkflowStatus = 'DRAFT' | 'APPROVAL_REQUIRED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AiApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AiInsightStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

@Entity('ai_skill_installs')
@Index(['ownerId', 'skillId'], { unique: true })
export class AiSkillInstall extends OwnedEntity {
  @Column({ length: 80 }) skillId!: string;
  @Column({ default: true }) enabled!: boolean;
  @Column({ type: 'jsonb', default: {} }) config!: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) installedAt?: Date | null;
}

@Entity('ai_memory_nodes')
@Index(['ownerId', 'nodeType', 'externalKey'], { unique: true })
export class AiMemoryNode extends OwnedEntity {
  @Column({ length: 60 }) nodeType!: string;
  @Column({ length: 160 }) externalKey!: string;
  @Column({ length: 220 }) label!: string;
  @Column({ type: 'jsonb', default: {} }) attributes!: Record<string, unknown>;
  @Column({ type: 'float', default: 1 }) confidence!: number;
  @Column({ default: 'user' }) source!: string;
  @Column({ type: 'timestamptz', nullable: true }) lastVerifiedAt?: Date | null;
}

@Entity('ai_memory_edges')
@Index(['ownerId', 'fromNodeId', 'relation', 'toNodeId'], { unique: true })
export class AiMemoryEdge extends OwnedEntity {
  @Column('uuid') fromNodeId!: string;
  @Column({ length: 80 }) relation!: string;
  @Column('uuid') toNodeId!: string;
  @Column({ type: 'jsonb', default: {} }) attributes!: Record<string, unknown>;
  @Column({ type: 'float', default: 1 }) confidence!: number;
}

export interface AiWorkflowStep {
  id: string;
  title: string;
  description: string;
  type: 'READ' | 'ANALYSE' | 'ACTION' | 'APPROVAL' | 'OUTPUT';
  tool?: string;
  args?: Record<string, unknown>;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  result?: unknown;
}

@Entity('ai_workflow_plans')
@Index(['ownerId', 'status', 'createdAt'])
export class AiWorkflowPlan extends OwnedEntity {
  @Column({ length: 160 }) title!: string;
  @Column({ type: 'text' }) objective!: string;
  @Column({ default: 'DRAFT' }) status!: AiWorkflowStatus;
  @Column({ type: 'jsonb', default: [] }) steps!: AiWorkflowStep[];
  @Column({ type: 'jsonb', default: {} }) context!: Record<string, unknown>;
  @Column({ default: 'medium' }) riskLevel!: 'low' | 'medium' | 'high';
  @Column({ type: 'float', default: 0.5 }) confidence!: number;
  @Column({ type: 'int', default: 0 }) currentStep!: number;
  @Column({ type: 'text', default: '' }) summary!: string;
  @Column({ type: 'timestamptz', nullable: true }) approvedAt?: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt?: Date | null;
}

export interface AiApprovalChainStep {
  role: string;
  label: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  actorId?: string;
  actedAt?: string;
  note?: string;
}

@Entity('ai_approval_requests')
@Index(['ownerId', 'status', 'createdAt'])
export class AiApprovalRequest extends OwnedEntity {
  @Column({ type: 'uuid', nullable: true }) workflowId?: string | null;
  @Column({ length: 120 }) actionType!: string;
  @Column({ type: 'text' }) summary!: string;
  @Column({ type: 'jsonb', default: {} }) payload!: Record<string, unknown>;
  @Column({ type: 'jsonb', default: [] }) chain!: AiApprovalChainStep[];
  @Column({ type: 'int', default: 0 }) currentStep!: number;
  @Column({ default: 'PENDING' }) status!: AiApprovalStatus;
  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true }) amount?: string | null;
  @Column({ default: 'TZS' }) currency!: string;
  @Column({ type: 'timestamptz', nullable: true }) decidedAt?: Date | null;
}

@Entity('ai_operating_audit')
@Index(['ownerId', 'createdAt'])
@Index(['ownerId', 'eventType'])
export class AiOperatingAudit extends OwnedEntity {
  @Column({ type: 'uuid', nullable: true }) actorId?: string | null;
  @Column({ default: '' }) actorRole!: string;
  @Column({ length: 80 }) eventType!: string;
  @Column({ default: '' }) module!: string;
  @Column({ default: '' }) action!: string;
  @Column({ default: '' }) model!: string;
  @Column({ default: '' }) tool!: string;
  @Column({ type: 'float', default: 0 }) confidence!: number;
  @Column({ type: 'jsonb', default: [] }) citations!: Array<Record<string, unknown>>;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
}

@Entity('ai_dashboards')
@Index(['ownerId', 'name'])
export class AiDashboardSpec extends OwnedEntity {
  @Column({ length: 160 }) name!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'jsonb', default: [] }) widgets!: Array<Record<string, unknown>>;
  @Column({ type: 'jsonb', default: {} }) filters!: Record<string, unknown>;
  @Column({ default: true }) createdByAi!: boolean;
}

@Entity('ai_insights')
@Index(['ownerId', 'status', 'severity'])
@Index(['ownerId', 'dedupeKey'], { unique: true })
export class AiInsight extends OwnedEntity {
  @Column({ length: 120 }) dedupeKey!: string;
  @Column({ length: 80 }) insightType!: string;
  @Column({ default: 'info' }) severity!: 'info' | 'warning' | 'critical';
  @Column({ length: 180 }) title!: string;
  @Column({ type: 'text' }) summary!: string;
  @Column({ type: 'jsonb', default: {} }) evidence!: Record<string, unknown>;
  @Column({ default: 'OPEN' }) status!: AiInsightStatus;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt?: Date | null;
}
