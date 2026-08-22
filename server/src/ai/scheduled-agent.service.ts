import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { KobeAgentService } from './agent.service';
import { AiAgentRun, AiScheduledAgent } from './scheduled-agent.entity';
import { CreateScheduledAgentDto, UpdateScheduledAgentDto } from './dto/scheduled-agent.dto';

const WRITE_TOOLS = [
  'set_rent',
  'send_tenant_notification',
  'record_expense',
  'set_room_status',
  'adjust_stock',
  'add_tenant',
  'add_product',
  'create_booking',
  'record_rent_payment',
] as const;

const MODULES = [
  'erp', 'inventory', 'hotel', 'property', 'cargo', 'payments', 'customers', 'reports',
] as const;

function validateTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new BadRequestException(`Invalid timezone: ${timezone}`);
  }
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    weekday,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

function nextScheduledAt(agent: Pick<AiScheduledAgent, 'frequency' | 'timeOfDay' | 'intervalHours' | 'daysOfWeek' | 'timezone'>, from = new Date()): Date {
  if (agent.frequency === 'HOURLY') {
    return new Date(from.getTime() + Math.max(1, agent.intervalHours || 1) * 3_600_000);
  }
  const [hour, minute] = (agent.timeOfDay || '08:00').split(':').map(Number);
  const allowedDays = agent.frequency === 'WEEKLY'
    ? new Set(agent.daysOfWeek?.length ? agent.daysOfWeek : [1])
    : null;
  const start = new Date(Math.ceil((from.getTime() + 30_000) / 60_000) * 60_000);
  // Search UTC minutes and compare their local wall-clock parts. This works
  // across DST transitions without adding a timezone dependency.
  for (let offset = 0; offset <= 8 * 24 * 60; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    const local = localParts(candidate, agent.timezone);
    if (local.hour === hour && local.minute === minute && (!allowedDays || allowedDays.has(local.weekday))) {
      return candidate;
    }
  }
  throw new BadRequestException('Could not calculate the next scheduled run');
}

@Injectable()
export class ScheduledAgentService {
  private readonly logger = new Logger(ScheduledAgentService.name);

  constructor(
    @InjectRepository(AiScheduledAgent)
    private readonly agents: Repository<AiScheduledAgent>,
    @InjectRepository(AiAgentRun)
    private readonly runs: Repository<AiAgentRun>,
    private readonly businessAgent: KobeAgentService,
  ) {}

  metadata() {
    return {
      modules: MODULES,
      writeTools: WRITE_TOOLS,
      approvalModes: ['AUTOMATIC', 'APPROVAL_REQUIRED', 'DRAFT_ONLY'],
      frequencies: ['HOURLY', 'DAILY', 'WEEKLY'],
      outputs: ['KOBEOS_INBOX', 'SMS_OWNER', 'DRAFT_ONLY'],
    };
  }

  async list(ownerId: string) {
    return this.agents.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async get(ownerId: string, id: string) {
    const agent = await this.agents.findOne({ where: { ownerId, id } });
    if (!agent) throw new NotFoundException('Scheduled agent not found');
    return agent;
  }

  async listRuns(ownerId: string, agentId?: string) {
    return this.runs.find({
      where: agentId ? { ownerId, agentId } : { ownerId },
      order: { startedAt: 'DESC' },
      take: 500,
    });
  }

  async create(ownerId: string, dto: CreateScheduledAgentDto) {
    const timezone = validateTimezone(dto.timezone);
    if (dto.frequency === 'WEEKLY' && !dto.daysOfWeek?.length) {
      throw new BadRequestException('Select at least one weekday');
    }
    const agent = this.agents.create({
      ownerId,
      name: dto.name.trim(),
      objective: dto.objective.trim(),
      frequency: dto.frequency,
      timeOfDay: dto.timeOfDay || '08:00',
      intervalHours: dto.intervalHours || 24,
      daysOfWeek: [...new Set(dto.daysOfWeek || [])],
      timezone,
      allowedModules: [...new Set(dto.allowedModules)],
      allowedTools: [...new Set(dto.allowedTools)].filter((tool) => WRITE_TOOLS.includes(tool as typeof WRITE_TOOLS[number])),
      approvalMode: dto.approvalMode,
      inputSources: [...new Set(dto.inputSources || [])],
      outputDestination: dto.outputDestination,
      status: dto.enabled === false ? 'PAUSED' : 'ACTIVE',
      nextRunAt: new Date(),
      consecutiveFailures: 0,
      lastError: '',
    });
    agent.nextRunAt = nextScheduledAt(agent);
    return this.agents.save(agent);
  }

  async update(ownerId: string, id: string, dto: UpdateScheduledAgentDto) {
    const agent = await this.get(ownerId, id);
    if (dto.name !== undefined) agent.name = dto.name.trim();
    if (dto.objective !== undefined) agent.objective = dto.objective.trim();
    if (dto.frequency !== undefined) agent.frequency = dto.frequency;
    if (dto.timeOfDay !== undefined) agent.timeOfDay = dto.timeOfDay;
    if (dto.intervalHours !== undefined) agent.intervalHours = dto.intervalHours;
    if (dto.daysOfWeek !== undefined) agent.daysOfWeek = [...new Set(dto.daysOfWeek)];
    if (dto.timezone !== undefined) agent.timezone = validateTimezone(dto.timezone);
    if (dto.allowedModules !== undefined) agent.allowedModules = [...new Set(dto.allowedModules)];
    if (dto.allowedTools !== undefined) agent.allowedTools = [...new Set(dto.allowedTools)].filter((tool) => WRITE_TOOLS.includes(tool as typeof WRITE_TOOLS[number]));
    if (dto.approvalMode !== undefined) agent.approvalMode = dto.approvalMode;
    if (dto.inputSources !== undefined) agent.inputSources = [...new Set(dto.inputSources)];
    if (dto.outputDestination !== undefined) agent.outputDestination = dto.outputDestination;
    if (dto.enabled !== undefined) agent.status = dto.enabled ? 'ACTIVE' : 'PAUSED';
    if (agent.frequency === 'WEEKLY' && !agent.daysOfWeek.length) throw new BadRequestException('Select at least one weekday');
    agent.nextRunAt = nextScheduledAt(agent);
    agent.lastError = '';
    return this.agents.save(agent);
  }

  async remove(ownerId: string, id: string) {
    const agent = await this.get(ownerId, id);
    await this.agents.remove(agent);
    return { deleted: true };
  }

  async pause(ownerId: string, id: string) {
    const agent = await this.get(ownerId, id);
    agent.status = 'PAUSED';
    agent.leaseUntil = null;
    return this.agents.save(agent);
  }

  async resume(ownerId: string, id: string) {
    const agent = await this.get(ownerId, id);
    agent.status = 'ACTIVE';
    agent.consecutiveFailures = 0;
    agent.lastError = '';
    agent.nextRunAt = nextScheduledAt(agent);
    return this.agents.save(agent);
  }

  async test(ownerId: string, id: string, executeAutomaticAction = false) {
    const agent = await this.get(ownerId, id);
    return this.executeAgent(agent, executeAutomaticAction, true);
  }

  async approve(ownerId: string, runId: string) {
    const run = await this.runs.findOne({ where: { ownerId, id: runId } });
    if (!run) throw new NotFoundException('Agent run not found');
    if (run.status !== 'AWAITING_APPROVAL' || !run.pendingAction) {
      throw new BadRequestException('This run has no pending action to approve');
    }
    const agent = await this.get(ownerId, run.agentId);
    if (agent.approvalMode !== 'APPROVAL_REQUIRED') throw new BadRequestException('This agent does not permit approval execution');
    if (!agent.allowedTools.includes(run.pendingAction.tool)) throw new BadRequestException('The pending tool is no longer allowed');
    const result = await this.businessAgent.execute(ownerId, run.pendingAction);
    run.approvedAt = new Date();
    run.finishedAt = new Date();
    run.status = result.ok ? 'SUCCEEDED' : 'FAILED';
    run.summary = result.message;
    run.result = { execution: result };
    run.error = result.ok ? '' : result.message;
    return this.runs.save(run);
  }

  async reject(ownerId: string, runId: string) {
    const run = await this.runs.findOne({ where: { ownerId, id: runId } });
    if (!run) throw new NotFoundException('Agent run not found');
    if (run.status !== 'AWAITING_APPROVAL') throw new BadRequestException('This run is not awaiting approval');
    run.rejectedAt = new Date();
    run.finishedAt = new Date();
    run.status = 'SKIPPED';
    run.summary = 'Pending action rejected by the user.';
    return this.runs.save(run);
  }

  /** Claim and run due agents every minute. */
  @Cron('*/1 * * * *')
  async runDueAgents() {
    const now = new Date();
    const due = await this.agents.find({
      where: { status: 'ACTIVE', nextRunAt: LessThanOrEqual(now) },
      order: { nextRunAt: 'ASC' },
      take: 25,
    });
    for (const agent of due) {
      const leaseUntil = new Date(Date.now() + 10 * 60_000);
      const claimed = await this.agents.createQueryBuilder()
        .update(AiScheduledAgent)
        .set({ status: 'RUNNING', leaseUntil })
        .where('id = :id AND ownerId = :ownerId AND status = :status AND nextRunAt <= :now', {
          id: agent.id,
          ownerId: agent.ownerId,
          status: 'ACTIVE',
          now,
        })
        .execute();
      if (!claimed.affected) continue;
      try {
        const fresh = await this.get(agent.ownerId, agent.id);
        await this.executeAgent(fresh, true, false);
      } catch (error) {
        this.logger.warn(`scheduled agent ${agent.id} failed: ${(error as Error).message}`);
      }
    }
  }

  private async executeAgent(agent: AiScheduledAgent, executeAutomaticAction: boolean, testRun: boolean) {
    const startedAt = new Date();
    const run = await this.runs.save(this.runs.create({
      ownerId: agent.ownerId,
      agentId: agent.id,
      status: 'RUNNING',
      startedAt,
      result: {},
      summary: '',
      error: '',
      wasAutomaticAction: false,
      pendingAction: null,
    }));

    try {
      const instruction = [
        `Scheduled agent: ${agent.name}`,
        `Objective: ${agent.objective}`,
        `Allowed business modules: ${agent.allowedModules.join(', ') || 'read-only business overview'}.`,
        `Input sources: ${agent.inputSources.join(', ') || 'authorised KobeOS business data'}.`,
        `Output destination: ${agent.outputDestination}.`,
        'Return a concise result. Never claim an action was completed unless the tool execution result confirms it.',
      ].join('\n');
      const response = await this.businessAgent.run(agent.ownerId, instruction, []);
      run.result = { reply: response.reply, used: response.used, data: response.data };
      run.summary = response.reply;

      if (response.pendingAction) {
        run.pendingAction = response.pendingAction;
        if (!agent.allowedTools.includes(response.pendingAction.tool)) {
          run.status = 'SKIPPED';
          run.summary = `Action not executed: ${response.pendingAction.tool} is outside this agent's permissions.`;
        } else if (agent.approvalMode === 'AUTOMATIC' && executeAutomaticAction) {
          const execution = await this.businessAgent.execute(agent.ownerId, response.pendingAction);
          run.wasAutomaticAction = true;
          run.result = { ...run.result, execution };
          run.summary = execution.message;
          run.status = execution.ok ? 'SUCCEEDED' : 'FAILED';
          if (!execution.ok) run.error = execution.message;
        } else if (agent.approvalMode === 'APPROVAL_REQUIRED') {
          run.status = 'AWAITING_APPROVAL';
          run.summary = response.pendingAction.summary;
        } else {
          run.status = 'SUCCEEDED';
          run.summary = `Draft only: ${response.pendingAction.summary}`;
        }
      } else {
        run.status = 'SUCCEEDED';
      }
      run.finishedAt = new Date();
      await this.runs.save(run);

      if (!testRun) {
        agent.status = 'ACTIVE';
        agent.lastRunAt = startedAt;
        agent.lastSuccessAt = run.status === 'FAILED' ? agent.lastSuccessAt : new Date();
        agent.nextRunAt = nextScheduledAt(agent, new Date());
        agent.leaseUntil = null;
        agent.consecutiveFailures = run.status === 'FAILED' ? agent.consecutiveFailures + 1 : 0;
        agent.lastError = run.error;
        await this.agents.save(agent);
      }
      return run;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run.status = 'FAILED';
      run.error = message;
      run.summary = `Agent failed: ${message}`;
      run.finishedAt = new Date();
      await this.runs.save(run);

      if (!testRun) {
        const failures = agent.consecutiveFailures + 1;
        agent.status = failures >= 5 ? 'ERROR' : 'ACTIVE';
        agent.consecutiveFailures = failures;
        agent.lastError = message;
        agent.lastRunAt = startedAt;
        agent.leaseUntil = null;
        // Safe retry with exponential backoff, capped at 24 hours.
        const retryMinutes = Math.min(24 * 60, 15 * 2 ** Math.min(6, failures - 1));
        agent.nextRunAt = new Date(Date.now() + retryMinutes * 60_000);
        await this.agents.save(agent);
      }
      return run;
    }
  }
}
