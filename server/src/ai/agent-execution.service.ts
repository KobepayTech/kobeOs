import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentExecutionStatus, AiAgentExecution } from './agent-execution.entity';

export interface ToolHealth {
  tool: string;
  runs: number;
  failures: number;
  cacheHits: number;
  avgDurationMs: number;
  slowestMs: number;
  lastRunAt: string | null;
}

export interface AgentActivitySummary {
  runs: number;
  failures: number;
  failureRate: number;
  cacheHitRate: number;
  writes: number;
  tools: ToolHealth[];
}

/** Rows older than this are pruned; this is operational telemetry, not history. */
const RETENTION_DAYS = 30;

/**
 * Summarise a batch of executions. Pure so the arithmetic — especially the
 * rates, which are easy to get wrong when there are no runs — is testable
 * without a database.
 */
export function summariseExecutions(rows: AiAgentExecution[]): AgentActivitySummary {
  const byTool = new Map<string, ToolHealth>();
  let failures = 0;
  let cacheHits = 0;
  let writes = 0;

  for (const row of rows) {
    if (row.status === 'error') failures += 1;
    if (row.cached) cacheHits += 1;
    if (row.write) writes += 1;

    const entry = byTool.get(row.tool) ?? {
      tool: row.tool, runs: 0, failures: 0, cacheHits: 0, avgDurationMs: 0, slowestMs: 0, lastRunAt: null,
    };
    entry.runs += 1;
    if (row.status === 'error') entry.failures += 1;
    if (row.cached) entry.cacheHits += 1;
    // Accumulate the total here and divide once at the end; averaging averages
    // would weight early calls more heavily.
    entry.avgDurationMs += row.durationMs;
    entry.slowestMs = Math.max(entry.slowestMs, row.durationMs);
    const at = row.startedAt instanceof Date ? row.startedAt.toISOString() : String(row.startedAt);
    if (!entry.lastRunAt || at > entry.lastRunAt) entry.lastRunAt = at;
    byTool.set(row.tool, entry);
  }

  const tools = [...byTool.values()]
    .map((entry) => ({ ...entry, avgDurationMs: Math.round(entry.avgDurationMs / entry.runs) }))
    .sort((a, b) => b.failures - a.failures || b.runs - a.runs);

  const runs = rows.length;
  return {
    runs,
    failures,
    failureRate: runs ? +(failures / runs).toFixed(4) : 0,
    cacheHitRate: runs ? +(cacheHits / runs).toFixed(4) : 0,
    writes,
    tools,
  };
}

@Injectable()
export class AgentExecutionService {
  private readonly logger = new Logger(AgentExecutionService.name);

  constructor(
    @InjectRepository(AiAgentExecution) private readonly repo: Repository<AiAgentExecution>,
  ) {}

  /**
   * Record a finished tool call. Never throws: monitoring a tool must not be
   * able to break the tool, so a failure here is logged and swallowed.
   */
  async record(entry: {
    ownerId: string;
    tool: string;
    status: AgentExecutionStatus;
    startedAt: Date;
    durationMs: number;
    cached?: boolean;
    write?: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await this.repo.insert({
        ownerId: entry.ownerId,
        tool: entry.tool,
        status: entry.status,
        startedAt: entry.startedAt,
        durationMs: Math.max(0, Math.round(entry.durationMs)),
        cached: !!entry.cached,
        write: !!entry.write,
        error: (entry.error ?? '').slice(0, 500),
      });
    } catch (cause) {
      this.logger.warn(`Could not record tool execution for ${entry.tool}: ${(cause as Error)?.message}`);
    }
  }

  recent(ownerId: string, limit = 50): Promise<AiAgentExecution[]> {
    return this.repo.find({
      where: { ownerId },
      order: { startedAt: 'DESC', id: 'DESC' },
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  async summary(ownerId: string, sinceHours = 24): Promise<AgentActivitySummary> {
    const since = new Date(Date.now() - Math.max(1, sinceHours) * 3600_000);
    const rows = await this.repo
      .createQueryBuilder('e')
      .where('e."ownerId" = :ownerId AND e."startedAt" >= :since', { ownerId, since })
      .orderBy('e."startedAt"', 'DESC')
      .take(5000)
      .getMany();
    return summariseExecutions(rows);
  }

  async prune(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600_000);
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"startedAt" < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
