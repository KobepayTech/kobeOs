import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  MobileSubscription,
  MOBILE_SUB_PRICE_TZS,
  MOBILE_TRIAL_MS,
  MOBILE_MODULE_TRIAL_MS,
  MOBILE_PERIOD_MS,
  type MobileSubStatus,
} from './mobile-subscription.entity';
import { PalmPesaService } from '../creators/palmpesa.service';
import type { PalmPesaCallback } from '../creators/palmpesa.service';

export type MobileAccess = 'active' | 'trial' | 'expired';

export interface MobileModuleDefinition {
  id: string;
  name: string;
  description: string;
  priceTzs: number;
  included: boolean;
}

/**
 * Mobile modules are products of their own. Core selling tools ship with the
 * base mobile subscription; operational add-ons are hidden until purchased.
 */
export const MOBILE_MODULE_CATALOG: MobileModuleDefinition[] = [
  { id: 'pos', name: 'POS', description: 'Sell products and take payment from a phone.', priceTzs: 0, included: true },
  { id: 'inventory', name: 'Inventory', description: 'Check shared stock and product availability.', priceTzs: 0, included: true },
  { id: 'orders', name: 'Orders', description: 'Review store and POS orders.', priceTzs: 0, included: true },
  { id: 'image-order', name: 'Order from image', description: 'Turn an annotated customer image into an order.', priceTzs: 0, included: true },
  { id: 'po', name: 'Purchasing', description: 'Create and receive purchase orders.', priceTzs: 0, included: true },
  { id: 'discounts', name: 'Discount approvals', description: 'Approve, counter, or reject cashier discount requests.', priceTzs: 0, included: true },
  { id: 'dispatch', name: 'Dispatch', description: 'Pack, assign, and dispatch deliveries.', priceTzs: 35_000, included: false },
  { id: 'hotel', name: 'Hotel', description: 'Run hotel operations as a separate mobile app.', priceTzs: 50_000, included: false },
  { id: 'lipa', name: 'Lipa', description: 'Mobile collections and payment operations.', priceTzs: 30_000, included: false },
  { id: 'eod', name: 'Till & EOD', description: 'Close tills and complete end-of-day checks.', priceTzs: 20_000, included: false },
  { id: 'summary', name: 'Business summary', description: 'Mobile sales and expense summaries.', priceTzs: 20_000, included: false },
];

export interface MobileModuleAccess extends MobileModuleDefinition {
  enabled: boolean;
  expiresAt: number | null;
}

export interface MobileAccessResult {
  slug: string;
  access: MobileAccess;
  priceTzs: number;
  /** Trial end (ms epoch) or null once past/never-trialing. */
  trialEndsAt: number | null;
  /** Paid-period end (ms epoch) or null when not on a paid period. */
  periodEndsAt: number | null;
  /** Whole hours left in the trial (0 unless access === 'trial'). */
  hoursRemaining: number;
  modules: MobileModuleAccess[];
  enabledModules: string[];
}

/** PalmPesa reference prefix — routes callbacks back here (see WebhookService). */
const TX_PREFIX = 'msub_';

@Injectable()
export class MobileSubscriptionService {
  private readonly logger = new Logger(MobileSubscriptionService.name);

  constructor(
    @InjectRepository(MobileSubscription)
    private readonly repo: Repository<MobileSubscription>,
    private readonly palmPesa: PalmPesaService,
  ) {}

  private norm(slug: string): string {
    return (slug ?? '').trim().toLowerCase();
  }

  private baseStatus(sub: MobileSubscription, now = Date.now()): MobileSubStatus {
    if (sub.currentPeriodEndsAt && sub.currentPeriodEndsAt.getTime() > now) return 'active';
    if (!sub.currentPeriodEndsAt && sub.trialEndsAt && sub.trialEndsAt.getTime() > now) return 'trialing';
    return 'expired';
  }

  /**
   * Resolve a shop's current access. Lazily starts the 14-day trial the first
   * time a shop is seen. Access is derived from timestamps (paid period wins,
   * else an unused trial that's still valid, else expired) so it can't drift
   * from a stale status column.
   */
  async getAccess(slugRaw: string): Promise<MobileAccessResult> {
    const slug = this.norm(slugRaw);
    if (!slug) throw new BadRequestException('slug is required');

    const now = Date.now();
    let sub = await this.repo.findOne({ where: { slug } });
    if (!sub) {
      sub = await this.repo.save(
        this.repo.create({
          slug,
          status: 'trialing',
          trialEndsAt: new Date(now + MOBILE_TRIAL_MS),
          amountTzs: 0,
        }),
      );
      this.logger.log(`Mobile trial started for shop "${slug}" (14 days).`);
    }

    // Upgrade active legacy 48-hour trials to the current 14-day policy
    // without restarting trials for shops older than fourteen days.
    if (!sub.currentPeriodEndsAt && sub.trialEndsAt && sub.createdAt) {
      const policyEnd = sub.createdAt.getTime() + MOBILE_TRIAL_MS;
      if (sub.trialEndsAt.getTime() < policyEnd && policyEnd > now) {
        sub.trialEndsAt = new Date(policyEnd);
        await this.repo.save(sub);
      }
    }

    const paidActive = !!sub.currentPeriodEndsAt && sub.currentPeriodEndsAt.getTime() > now;
    // A trial only applies when the shop has NEVER paid.
    const trialActive =
      !sub.currentPeriodEndsAt && !!sub.trialEndsAt && sub.trialEndsAt.getTime() > now;
    const access: MobileAccess = paidActive ? 'active' : trialActive ? 'trial' : 'expired';

    // Keep the coarse status column in sync for admin/reporting, but never
    // clobber an in-flight 'pending' payment.
    const label = access === 'active' ? 'active' : access === 'trial' ? 'trialing' : 'expired';
    if (sub.status !== 'pending' && sub.status !== label) {
      sub.status = label;
      await this.repo.save(sub);
    }

    const entitlements = sub.moduleEntitlements ?? {};
    const modules = MOBILE_MODULE_CATALOG.map<MobileModuleAccess>((module) => {
      const parsedExpiry = module.included ? NaN : Date.parse(entitlements[module.id] ?? '');
      const expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry : null;
      return {
        ...module,
        enabled: module.included || (expiresAt !== null && expiresAt > now),
        expiresAt,
      };
    });

    return {
      slug,
      access,
      priceTzs: MOBILE_SUB_PRICE_TZS,
      trialEndsAt: sub.trialEndsAt?.getTime() ?? null,
      periodEndsAt: sub.currentPeriodEndsAt?.getTime() ?? null,
      hoursRemaining: trialActive
        ? Math.max(0, Math.ceil((sub.trialEndsAt!.getTime() - now) / 3_600_000))
        : 0,
      modules,
      enabledModules: modules.filter((module) => module.enabled).map((module) => module.id),
    };
  }

  /**
   * Start a PalmPesa USSD push for a shop's monthly subscription. Any signed-in
   * staff member may pay on the shop's behalf. Returns the transaction id the
   * client polls via getStatus.
   */
  async subscribe(slugRaw: string, userId: string, msisdn: string) {
    const slug = this.norm(slugRaw);
    if (!slug) throw new BadRequestException('slug is required');

    const transactionId = `${TX_PREFIX}${randomUUID()}`;
    const { order_id } = await this.palmPesa.initiatePayment({
      name: `KobeOS Mobile ${slug}`,
      email: `${slug}@kobeos.local`,
      phone: msisdn,
      amountTzs: MOBILE_SUB_PRICE_TZS,
      transactionId,
      description: `KobeOS Mobile workspace (${slug}) — 30 days`,
    });

    let sub = await this.repo.findOne({ where: { slug } });
    if (!sub) sub = this.repo.create({ slug });
    sub.transactionId = transactionId;
    sub.palmPesaOrderId = order_id;
    sub.amountTzs = MOBILE_SUB_PRICE_TZS;
    sub.status = 'pending';
    sub.pendingModuleId = null;
    sub.lastPaidByUserId = userId ?? null;
    sub.callbackPayload = null;
    sub.palmPesaTransId = null;
    sub.channel = null;
    await this.repo.save(sub);

    return { transactionId, orderId: order_id, amount: MOBILE_SUB_PRICE_TZS, slug };
  }

  /** Install one optional module without requiring a configured payment
   * provider. The first install gets a single 14-day trial. An expired
   * entitlement remains in the JSON map, which prevents trial resets. */
  async installModuleTrial(slugRaw: string, moduleId: string) {
    const slug = this.norm(slugRaw);
    if (!slug) throw new BadRequestException('slug is required');
    const module = MOBILE_MODULE_CATALOG.find((item) => item.id === moduleId);
    if (!module) throw new BadRequestException('Unknown mobile module');
    if (module.included) {
      return { moduleId, status: 'active', trialEndsAt: null, included: true };
    }

    const access = await this.getAccess(slug);
    if (access.access === 'expired') {
      throw new BadRequestException('Renew the base mobile subscription before adding modules');
    }

    const sub = await this.repo.findOne({ where: { slug } });
    if (!sub) throw new NotFoundException('Mobile subscription not found');
    const previous = sub.moduleEntitlements?.[module.id];
    const previousExpiry = Date.parse(previous ?? '');
    if (Number.isFinite(previousExpiry) && previousExpiry > Date.now()) {
      return { moduleId, status: 'active', trialEndsAt: previousExpiry, included: false };
    }
    if (previous) {
      throw new BadRequestException(
        `${module.name} trial has ended. Configure PalmPesa to renew this module.`,
      );
    }

    const trialEndsAt = Date.now() + MOBILE_MODULE_TRIAL_MS;
    sub.moduleEntitlements = {
      ...(sub.moduleEntitlements ?? {}),
      [module.id]: new Date(trialEndsAt).toISOString(),
    };
    await this.repo.save(sub);
    this.logger.log(`Mobile module "${module.id}" trial ACTIVE for shop "${slug}" (14 days).`);
    return { moduleId, status: 'trial', trialEndsAt, included: false };
  }

  /** Start a separate 30-day subscription for one optional mobile module. */
  async subscribeModule(slugRaw: string, userId: string, msisdn: string, moduleId: string) {
    const slug = this.norm(slugRaw);
    if (!slug) throw new BadRequestException('slug is required');
    const module = MOBILE_MODULE_CATALOG.find((item) => item.id === moduleId);
    if (!module || module.included) throw new BadRequestException('Unknown or included module');

    const access = await this.getAccess(slug);
    if (access.access === 'expired') {
      throw new BadRequestException('Renew the base mobile subscription before adding modules');
    }
    if (access.enabledModules.includes(module.id)) {
      throw new BadRequestException(`${module.name} is already active`);
    }

    const transactionId = `${TX_PREFIX}${randomUUID()}`;
    const { order_id } = await this.palmPesa.initiatePayment({
      name: `KobeOS ${module.name} ${slug}`,
      email: `${slug}@kobeos.local`,
      phone: msisdn,
      amountTzs: module.priceTzs,
      transactionId,
      description: `${module.name} mobile module (${slug}) — 30 days`,
    });

    const sub = await this.repo.findOne({ where: { slug } });
    if (!sub) throw new NotFoundException('Mobile subscription not found');
    sub.transactionId = transactionId;
    sub.palmPesaOrderId = order_id;
    sub.amountTzs = module.priceTzs;
    sub.status = 'pending';
    sub.pendingModuleId = module.id;
    sub.lastPaidByUserId = userId ?? null;
    sub.callbackPayload = null;
    sub.palmPesaTransId = null;
    sub.channel = null;
    await this.repo.save(sub);

    return { transactionId, orderId: order_id, amount: module.priceTzs, slug, moduleId: module.id };
  }

  /** Client polls this after the USSD push to learn when payment settled. */
  async getStatus(transactionId: string) {
    const sub = await this.repo.findOne({ where: { transactionId } });
    if (!sub) throw new NotFoundException('Transaction not found');
    const moduleId = sub.pendingModuleId ?? null;
    const moduleExpiry = moduleId ? Date.parse(sub.moduleEntitlements?.[moduleId] ?? '') : NaN;
    const moduleActive = Number.isFinite(moduleExpiry) && moduleExpiry > Date.now();
    const result: Record<string, unknown> = {
      status: moduleId && moduleActive ? 'active' : sub.status,
      moduleId,
      moduleActive,
    };
    if (sub.status === 'active' && sub.currentPeriodEndsAt) {
      result['periodEndsAt'] = sub.currentPeriodEndsAt.getTime();
    }
    return result;
  }

  /** PalmPesa callback — activates or fails the shop's subscription. */
  async handleCallback(payload: PalmPesaCallback): Promise<void> {
    const transactionId = payload.reference ?? payload.order_id;
    if (!transactionId) return;

    const sub = await this.repo.findOne({ where: { transactionId } });
    if (!sub) {
      this.logger.warn(`Mobile-sub callback for unknown transactionId: ${transactionId}`);
      return;
    }

    const previousCallback = sub.callbackPayload as PalmPesaCallback | null | undefined;
    if (
      payload.payment_status === 'COMPLETED' &&
      previousCallback?.payment_status === 'COMPLETED'
    ) {
      this.logger.log(`Ignoring duplicate mobile payment callback for ${transactionId}.`);
      return;
    }
    sub.callbackPayload = payload as unknown as Record<string, unknown>;

    if (payload.payment_status === 'COMPLETED') {
      const module = sub.pendingModuleId
        ? MOBILE_MODULE_CATALOG.find((item) => item.id === sub.pendingModuleId)
        : null;
      if (module && !module.included) {
        const now = Date.now();
        const currentExpiry = Date.parse(sub.moduleEntitlements?.[module.id] ?? '');
        const startsAt = Number.isFinite(currentExpiry) && currentExpiry > now ? currentExpiry : now;
        sub.moduleEntitlements = {
          ...(sub.moduleEntitlements ?? {}),
          [module.id]: new Date(startsAt + MOBILE_PERIOD_MS).toISOString(),
        };
        sub.status = this.baseStatus(sub, now);
        this.logger.log(`Mobile module "${module.id}" ACTIVE for shop "${sub.slug}" (30 days).`);
      } else {
        const now = Date.now();
        const existingEnd = sub.currentPeriodEndsAt?.getTime() ?? 0;
        const startsAt = Math.max(now, existingEnd);
        sub.status = 'active';
        sub.currentPeriodEndsAt = new Date(startsAt + MOBILE_PERIOD_MS);
        this.logger.log(`Mobile subscription ACTIVE for shop "${sub.slug}" (30 days).`);
      }
      sub.palmPesaTransId = payload.data?.[0]?.transid ?? null;
      sub.channel = payload.data?.[0]?.channel ?? null;
    } else if (payload.payment_status === 'FAILED') {
      sub.status = 'failed';
      this.logger.warn(`Mobile subscription payment FAILED for shop "${sub.slug}".`);
    }

    await this.repo.save(sub);
  }
}
