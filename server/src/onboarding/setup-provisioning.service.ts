import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ModuleEntitlementsService } from '../app-marketplace/module-entitlements.service';
import { ScheduledAgentService } from '../ai/scheduled-agent.service';
import {
  planFor, selectFromPlan,
  type GuidedAnswers, type PlannedAutomation, type SetupPlan,
} from './setup-plan';

/**
 * Turning the setup interview into a working business.
 *
 * The interview collects what the business is; this acts on it. Two steps on
 * purpose: a plan the owner reads, then the subset they ticked. Bundles are
 * entitlements and some are billed, so installing straight from an interview
 * answer would charge someone for answering a question.
 *
 * Each piece is applied independently and reported on. A shop that gets its
 * bundles but loses its connection before the automations are created should
 * keep the bundles and be able to finish the rest, not start the interview
 * again.
 */

/** Which modules an agent may read, by the business it serves. */
const AGENT_MODULES: Record<string, string[]> = {
  shop: ['erp', 'inventory', 'reports', 'customers'],
  hotel: ['hotel', 'reports', 'customers'],
  restaurant: ['hotel', 'erp', 'inventory', 'reports'],
  other: ['reports', 'payments'],
};

export interface ProvisionOutcome {
  bundles: Array<{ bundleId: string; status: 'installed' | 'failed'; error: string }>;
  automations: Array<{ key: string; name: string; status: 'created' | 'failed'; id: string; error: string }>;
}

@Injectable()
export class SetupProvisioningService {
  private readonly logger = new Logger(SetupProvisioningService.name);

  constructor(
    private readonly modules: ModuleEntitlementsService,
    private readonly agents: ScheduledAgentService,
  ) {}

  /** What this business probably needs. Reads nothing, changes nothing. */
  plan(answers: GuidedAnswers): SetupPlan {
    if (!String(answers?.businessType ?? '').trim()) {
      throw new BadRequestException('Finish the setup questions first, then we can suggest a workspace.');
    }
    return planFor(answers);
  }

  /**
   * Apply the ticked subset.
   *
   * Nothing ticked is a valid answer and does nothing — an owner who unticks
   * the lot has declined, and installing anyway would be charging them for it.
   */
  async provision(
    ownerId: string,
    answers: GuidedAnswers,
    chosen: { bundleIds?: string[]; automationKeys?: string[] },
  ): Promise<ProvisionOutcome & { plan: SetupPlan }> {
    const plan = this.plan(answers);
    const selected = selectFromPlan(plan, chosen ?? {});
    const outcome: ProvisionOutcome = { bundles: [], automations: [] };

    for (const bundle of selected.bundles) {
      try {
        await this.modules.installBundles(ownerId, [bundle.bundleId]);
        outcome.bundles.push({ bundleId: bundle.bundleId, status: 'installed', error: '' });
      } catch (error) {
        // One bundle failing must not discard the others: a half-provisioned
        // workspace the owner can finish beats starting over.
        const message = String((error as Error)?.message ?? error).slice(0, 300);
        outcome.bundles.push({ bundleId: bundle.bundleId, status: 'failed', error: message });
        this.logger.warn(`Bundle ${bundle.bundleId} not provisioned for ${ownerId}: ${message}`);
      }
    }

    for (const automation of selected.automations) {
      try {
        const created = await this.agents.create(ownerId, this.agentFor(plan, automation));
        outcome.automations.push({
          key: automation.key, name: automation.name, status: 'created',
          id: (created as { id?: string })?.id ?? '', error: '',
        });
      } catch (error) {
        const message = String((error as Error)?.message ?? error).slice(0, 300);
        outcome.automations.push({
          key: automation.key, name: automation.name, status: 'failed', id: '', error: message,
        });
        this.logger.warn(`Automation ${automation.key} not created for ${ownerId}: ${message}`);
      }
    }

    return { plan, ...outcome };
  }

  /**
   * The scheduled agent for a planned automation.
   *
   * Read-only by construction: no write tools, and the result goes to the
   * KobeOS inbox for a person to read rather than acting on anything. An agent
   * switched on during setup, before the owner has seen what it produces, must
   * not be able to change stock, prices or bookings.
   */
  private agentFor(plan: SetupPlan, automation: PlannedAutomation) {
    return {
      name: automation.name,
      objective: automation.objective,
      frequency: automation.frequency,
      timeOfDay: automation.timeOfDay,
      // Monday, for the weekly ones: a week's figures are complete by then.
      daysOfWeek: automation.frequency === 'WEEKLY' ? [1] : undefined,
      timezone: plan.timezone,
      allowedModules: AGENT_MODULES[plan.businessType] ?? AGENT_MODULES.other,
      allowedTools: [] as string[],
      approvalMode: 'DRAFT_ONLY' as const,
      inputSources: [] as string[],
      outputDestination: 'KOBEOS_INBOX' as const,
      enabled: true,
    };
  }
}
