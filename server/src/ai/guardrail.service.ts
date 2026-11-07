import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AiAgentExecution } from './agent-execution.entity';
import { AiGuardrailConfig, Guardrail, SUGGESTED_GUARDRAILS } from './guardrail.entity';
import { GuardrailDecision, checkInput, checkOutput, checkTool, sanitiseRules } from './guardrail.rules';

/** Raised when a rule stops the assistant; carries the shop's own wording. */
export class GuardrailBlockedException extends ForbiddenException {
  constructor(decision: GuardrailDecision) {
    super({ blockedBy: decision.kind, message: decision.reason ?? 'Blocked by a guardrail.' });
  }
}

@Injectable()
export class GuardrailService {
  /** Rules change rarely and are read on every tool call. */
  private cache = new Map<string, { at: number; config: AiGuardrailConfig | null }>();
  private static readonly TTL_MS = 30_000;

  constructor(
    @InjectRepository(AiGuardrailConfig) private readonly repo: Repository<AiGuardrailConfig>,
    @InjectRepository(AiAgentExecution) private readonly executions: Repository<AiAgentExecution>,
  ) {}

  suggestions(): Guardrail[] {
    return SUGGESTED_GUARDRAILS;
  }

  async get(ownerId: string): Promise<{ enabled: boolean; rules: Guardrail[] }> {
    const config = await this.load(ownerId);
    return { enabled: !!config?.enabled, rules: config?.rules ?? [] };
  }

  async save(ownerId: string, input: { enabled?: boolean; rules?: unknown }): Promise<{ enabled: boolean; rules: Guardrail[] }> {
    const existing = await this.repo.findOne({ where: { ownerId } });
    const config = existing ?? this.repo.create({ ownerId, enabled: false, rules: [] });
    if (input.enabled !== undefined) config.enabled = !!input.enabled;
    if (input.rules !== undefined) config.rules = sanitiseRules(input.rules);
    await this.repo.save(config);
    this.cache.delete(ownerId);
    return { enabled: config.enabled, rules: config.rules };
  }

  /** Rules currently in force; empty when the shop has not switched them on. */
  private async active(ownerId: string): Promise<Guardrail[]> {
    const config = await this.load(ownerId);
    return config?.enabled ? config.rules ?? [] : [];
  }

  async assertInputAllowed(ownerId: string, message: string): Promise<void> {
    const decision = checkInput(message, await this.active(ownerId));
    if (!decision.allowed) throw new GuardrailBlockedException(decision);
  }

  /** Returns the decision rather than throwing: a blocked reply is replaced,
   *  not turned into an error the user cannot read. */
  async reviewOutput(ownerId: string, reply: string): Promise<GuardrailDecision> {
    return checkOutput(reply, await this.active(ownerId));
  }

  async assertToolAllowed(ownerId: string, tool: string, write: boolean, now = new Date()): Promise<void> {
    const rules = await this.active(ownerId);
    if (!rules.length) return;

    // Only counted when a rule actually needs it — this is a database query on
    // the hot path for every write.
    const needsRate = write && rules.some((rule) => rule.kind === 'write_rate');
    const writesThisHour = needsRate ? await this.countRecentWrites(ownerId, now) : 0;

    const decision = checkTool(tool, { write, hour: now.getHours(), writesThisHour }, rules);
    if (!decision.allowed) throw new GuardrailBlockedException(decision);
  }

  private countRecentWrites(ownerId: string, now: Date): Promise<number> {
    return this.executions.count({
      where: {
        ownerId,
        write: true,
        startedAt: MoreThanOrEqual(new Date(now.getTime() - 3600_000)),
      },
    });
  }

  private async load(ownerId: string): Promise<AiGuardrailConfig | null> {
    const hit = this.cache.get(ownerId);
    if (hit && Date.now() - hit.at < GuardrailService.TTL_MS) return hit.config;
    const config = await this.repo.findOne({ where: { ownerId } });
    this.cache.set(ownerId, { at: Date.now(), config });
    return config;
  }
}
