import { AiAgentExecution } from './agent-execution.entity';
import { summariseExecutions } from './agent-execution.service';

const at = (iso: string) => new Date(iso);

const row = (over: Partial<AiAgentExecution>): AiAgentExecution => ({
  id: 'x', createdAt: at('2026-01-01T00:00:00Z'), updatedAt: at('2026-01-01T00:00:00Z'),
  ownerId: 'o', tool: 'sales_today', status: 'ok', startedAt: at('2026-01-01T00:00:00Z'),
  durationMs: 100, cached: false, write: false, error: '',
  ...over,
} as AiAgentExecution);

describe('assistant tool health', () => {
  it('reports zero rates rather than dividing by nothing', () => {
    const summary = summariseExecutions([]);
    expect(summary).toMatchObject({ runs: 0, failures: 0, failureRate: 0, cacheHitRate: 0, writes: 0 });
    expect(summary.tools).toEqual([]);
  });

  it('counts runs, failures, cache hits and writes', () => {
    const summary = summariseExecutions([
      row({ tool: 'sales_today' }),
      row({ tool: 'sales_today', cached: true }),
      row({ tool: 'record_expense', write: true }),
      row({ tool: 'cargo_status', status: 'error', error: 'boom' }),
    ]);
    expect(summary.runs).toBe(4);
    expect(summary.failures).toBe(1);
    expect(summary.writes).toBe(1);
    expect(summary.failureRate).toBe(0.25);
    expect(summary.cacheHitRate).toBe(0.25);
  });

  it('averages duration over the whole batch, not by averaging averages', () => {
    const summary = summariseExecutions([
      row({ tool: 'slow', durationMs: 100 }),
      row({ tool: 'slow', durationMs: 200 }),
      row({ tool: 'slow', durationMs: 300 }),
    ]);
    const slow = summary.tools.find((t) => t.tool === 'slow');
    expect(slow).toMatchObject({ runs: 3, avgDurationMs: 200, slowestMs: 300 });
  });

  it('surfaces the most broken tool first, then the busiest', () => {
    const summary = summariseExecutions([
      row({ tool: 'healthy' }), row({ tool: 'healthy' }), row({ tool: 'healthy' }),
      row({ tool: 'flaky', status: 'error' }),
      row({ tool: 'broken', status: 'error' }), row({ tool: 'broken', status: 'error' }),
    ]);
    expect(summary.tools.map((t) => t.tool)).toEqual(['broken', 'flaky', 'healthy']);
  });

  it('keeps the latest run time per tool', () => {
    const summary = summariseExecutions([
      row({ tool: 'sales_today', startedAt: at('2026-01-01T09:00:00Z') }),
      row({ tool: 'sales_today', startedAt: at('2026-01-01T11:00:00Z') }),
      row({ tool: 'sales_today', startedAt: at('2026-01-01T10:00:00Z') }),
    ]);
    expect(summary.tools[0].lastRunAt).toBe('2026-01-01T11:00:00.000Z');
  });

  it('does not let a cache hit look like a very fast real run', () => {
    // Cache hits are recorded with durationMs 0 and cached:true, so they must
    // be visible as hits rather than inflating how fast the tool looks.
    const summary = summariseExecutions([
      row({ tool: 'low_stock', durationMs: 400 }),
      row({ tool: 'low_stock', durationMs: 0, cached: true }),
    ]);
    const tool = summary.tools[0];
    expect(tool.cacheHits).toBe(1);
    expect(tool.runs).toBe(2);
    expect(summary.cacheHitRate).toBe(0.5);
  });
});
