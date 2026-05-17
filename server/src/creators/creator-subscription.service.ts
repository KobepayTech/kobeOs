import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CreatorSubscription,
  CreatorSubStatus,
  CreatorTier,
  TIER_PRICES,
} from './creator-subscription.entity';
import { Creator } from './creator.entity';
import { PalmPesaService, PalmPesaCallback } from './palmpesa.service';

@Injectable()
export class CreatorSubscriptionService {
  private readonly logger = new Logger(CreatorSubscriptionService.name);

  constructor(
    @InjectRepository(CreatorSubscription)
    private readonly subs: Repository<CreatorSubscription>,
    @InjectRepository(Creator)
    private readonly creators: Repository<Creator>,
    private readonly palmPesa: PalmPesaService,
  ) {}

  // ── Upgrade / initiate ────────────────────────────────────────────────────

  /**
   * Initiate a subscription upgrade for a creator.
   * Sends a USSD push to their phone via PalmPesa.
   * Returns the pending subscription record — tier is NOT activated yet.
   * Activation happens in handleCallback() when PalmPesa confirms payment.
   */
  async initiateUpgrade(params: {
    creatorId: string;
    tier: CreatorTier;
    phone: string;
    name: string;
    email: string;
  }): Promise<CreatorSubscription> {
    const { creatorId, tier, phone, name, email } = params;

    const creator = await this.creators.findOne({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Creator not found');

    if (tier === 'free') {
      throw new BadRequestException('Cannot charge for the free tier');
    }

    const amountTzs = TIER_PRICES[tier];
    const transactionId = this.palmPesa.generateTxId(creatorId, tier);

    // Initiate USSD push
    const initiated = await this.palmPesa.initiatePayment({
      name,
      email,
      phone,
      amountTzs,
      transactionId,
      description: `KobeCreator ${tier} weekly subscription`,
    });

    // Persist pending record
    const sub = await this.subs.save(
      this.subs.create({
        creatorId,
        tier,
        amountTzs,
        transactionId,
        palmPesaOrderId: initiated.order_id,
        status: 'pending',
      }),
    );

    this.logger.log(
      `Subscription initiated: creator=${creatorId} tier=${tier} order=${initiated.order_id}`,
    );
    return sub;
  }

  // ── Webhook callback handler ──────────────────────────────────────────────

  /**
   * Called by WebhookService when PalmPesa posts a callback to
   * POST /api/webhooks/palmpesa.
   *
   * PalmPesa callback shape:
   *   { order_id, payment_status: "COMPLETED"|"PENDING"|"FAILED" }
   */
  async handleCallback(payload: PalmPesaCallback): Promise<void> {
    const { order_id, payment_status } = payload;

    const sub = await this.subs.findOne({ where: { palmPesaOrderId: order_id } });
    if (!sub) {
      this.logger.warn(`PalmPesa callback for unknown order_id: ${order_id}`);
      return;
    }

    // Extract extra fields from nested data array if present
    const data = payload.data?.[0];
    const palmPesaTransId = data?.transid ?? null;
    const channel = data?.channel ?? null;

    sub.callbackPayload = payload as unknown as Record<string, unknown>;
    sub.palmPesaTransId = palmPesaTransId;
    sub.channel = channel;

    if (payment_status === 'COMPLETED') {
      sub.status = 'active';
      sub.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days

      // Activate the tier on the creator profile
      await this.creators.update(sub.creatorId, { subscriptionTier: sub.tier });
      await this.subs.save(sub);

      this.logger.log(
        `Subscription activated: creator=${sub.creatorId} tier=${sub.tier} ` +
        `expires=${sub.expiresAt.toISOString()} channel=${channel ?? '?'}`,
      );
    } else if (payment_status === 'FAILED') {
      sub.status = 'failed';
      await this.subs.save(sub);
      this.logger.warn(`Subscription payment failed: creator=${sub.creatorId} order=${order_id}`);
    } else {
      // PENDING — update payload but keep status as pending
      await this.subs.save(sub);
      this.logger.debug(`Subscription still pending: order=${order_id}`);
    }
  }

  // ── Weekly renewal cron ───────────────────────────────────────────────────

  /**
   * Every day at 6 AM: find active subscriptions expiring within 24 hours
   * and re-initiate payment for renewal. If payment fails, downgrade to free.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async renewExpiringSubscriptions(): Promise<void> {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiring = await this.subs.find({
      where: { status: 'active', expiresAt: LessThan(soon) },
    });

    if (expiring.length === 0) return;
    this.logger.log(`Renewing ${expiring.length} expiring subscription(s)`);

    for (const sub of expiring) {
      await this.renewOne(sub);
    }
  }

  /**
   * Daily at 7 AM: downgrade creators whose subscription expired and was
   * not renewed (status still active but expiresAt in the past).
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async expireOverdueSubscriptions(): Promise<void> {
    const now = new Date();
    const expired = await this.subs.find({
      where: { status: 'active', expiresAt: LessThan(now) },
    });

    for (const sub of expired) {
      sub.status = 'cancelled';
      await this.subs.save(sub);
      await this.creators.update(sub.creatorId, { subscriptionTier: 'free' });
      this.logger.log(`Subscription expired, downgraded to free: creator=${sub.creatorId}`);
    }
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getActiveSubscription(creatorId: string) {
    return this.subs.findOne({
      where: { creatorId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
  }

  getHistory(creatorId: string) {
    return this.subs.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async renewOne(sub: CreatorSubscription): Promise<void> {
    const creator = await this.creators.findOne({ where: { id: sub.creatorId } });
    if (!creator) return;

    const phone = creator.phone ?? '';
    if (!phone) {
      this.logger.warn(
        `Cannot renew subscription for creator ${sub.creatorId} (${creator.handle}): ` +
        `no phone on record. Creator must update their profile with a mobile number.`,
      );
      return;
    }

    try {
      await this.initiateUpgrade({
        creatorId: sub.creatorId,
        tier: sub.tier,
        phone,
        name: creator.name,
        email: creator.contactEmail ?? `${sub.creatorId}@kobecreator.app`,
      });
      this.logger.log(`Renewal initiated for creator ${creator.handle} (${sub.tier})`);
    } catch (err) {
      this.logger.error(
        `Renewal failed for creator ${sub.creatorId}: ${(err as Error).message}`,
      );
    }
  }
}
