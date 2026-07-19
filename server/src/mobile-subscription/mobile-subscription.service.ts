import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  MobileSubscription,
  MOBILE_SUB_PRICE_TZS,
  MOBILE_TRIAL_MS,
  MOBILE_PERIOD_MS,
} from './mobile-subscription.entity';
import { PalmPesaService } from '../creators/palmpesa.service';
import type { PalmPesaCallback } from '../creators/palmpesa.service';

export type MobileAccess = 'active' | 'trial' | 'expired';

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

  /**
   * Resolve a shop's current access. Lazily starts the 48h trial the first
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
      this.logger.log(`Mobile trial started for shop "${slug}" (48h).`);
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

    return {
      slug,
      access,
      priceTzs: MOBILE_SUB_PRICE_TZS,
      trialEndsAt: sub.trialEndsAt?.getTime() ?? null,
      periodEndsAt: sub.currentPeriodEndsAt?.getTime() ?? null,
      hoursRemaining: trialActive
        ? Math.max(0, Math.ceil((sub.trialEndsAt!.getTime() - now) / 3_600_000))
        : 0,
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
    sub.lastPaidByUserId = userId ?? null;
    await this.repo.save(sub);

    return { transactionId, orderId: order_id, amount: MOBILE_SUB_PRICE_TZS, slug };
  }

  /** Client polls this after the USSD push to learn when payment settled. */
  async getStatus(transactionId: string) {
    const sub = await this.repo.findOne({ where: { transactionId } });
    if (!sub) throw new NotFoundException('Transaction not found');
    const result: Record<string, unknown> = { status: sub.status };
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

    sub.callbackPayload = payload as unknown as Record<string, unknown>;

    if (payload.payment_status === 'COMPLETED') {
      sub.status = 'active';
      sub.currentPeriodEndsAt = new Date(Date.now() + MOBILE_PERIOD_MS);
      sub.palmPesaTransId = payload.data?.[0]?.transid ?? null;
      sub.channel = payload.data?.[0]?.channel ?? null;
      this.logger.log(`Mobile subscription ACTIVE for shop "${sub.slug}" (30 days).`);
    } else if (payload.payment_status === 'FAILED') {
      sub.status = 'failed';
      this.logger.warn(`Mobile subscription payment FAILED for shop "${sub.slug}".`);
    }

    await this.repo.save(sub);
  }
}
