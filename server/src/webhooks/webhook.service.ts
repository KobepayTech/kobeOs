import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from './webhook.entity';
import { PalmPesaCallback } from '../creators/palmpesa.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  // Injected lazily to avoid circular module dependency
  // Set by WebhooksModule after CreatorsModule / LicenseModule are loaded
  private creatorSubSvc?: import('../creators/creator-subscription.service').CreatorSubscriptionService;
  private licenseSvc?: import('../license/license.service').LicenseService;

  setCreatorSubscriptionService(
    svc: import('../creators/creator-subscription.service').CreatorSubscriptionService,
  ) {
    this.creatorSubSvc = svc;
  }

  setLicenseService(svc: import('../license/license.service').LicenseService) {
    this.licenseSvc = svc;
  }

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly repo: Repository<WebhookEvent>,
  ) {}

  /**
   * Persist the raw webhook payload, then dispatch to the appropriate handler.
   * Returns the saved event record.
   */
  async receive(
    provider: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookEvent> {
    const event = this.repo.create({
      provider: this.normalizeProvider(provider),
      eventType: eventType ?? 'unknown',
      payload,
      processed: false,
    });
    const saved = await this.repo.save(event);

    // Dispatch asynchronously — do not block the HTTP response
    this.dispatch(saved).catch((err: Error) => {
      this.logger.error(`Webhook dispatch failed for ${saved.id}: ${err.message}`);
    });

    return saved;
  }

  private async dispatch(event: WebhookEvent): Promise<void> {
    try {
      switch (event.provider) {
        case 'palmpesa': await this.handlePalmPesa(event); break;
        case 'mpesa':    await this.handleMpesa(event);    break;
        case 'stripe':   await this.handleStripe(event);   break;
        default:         await this.handleCustom(event);   break;
      }
      await this.repo.update(event.id, { processed: true, processedAt: new Date() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook ${event.id} (${event.provider}/${event.eventType}) failed: ${msg}`);
      await this.repo.update(event.id, { errorMessage: msg });
    }
  }

  // ── Provider handlers ────────────────────────────────────────────────────

  private async handlePalmPesa(event: WebhookEvent): Promise<void> {
    const payload = event.payload as unknown as PalmPesaCallback;

    // PalmPesa callbacks carry payment_status directly (not via eventType header)
    const paymentStatus = payload.payment_status
      ?? (event.eventType === 'payment.completed' ? 'COMPLETED' : undefined);

    this.logger.log(
      `PalmPesa callback: order=${payload.order_id ?? '—'} status=${paymentStatus ?? event.eventType}`,
    );

    // Route OS license payments (reference starts with "lic_") to LicenseService
    const ref = payload.reference ?? '';
    if (ref.startsWith('lic_') && this.licenseSvc) {
      await this.licenseSvc.handleCallback(payload);
      return;
    }

    // Route creator subscription payments to CreatorSubscriptionService
    if (payload.order_id && this.creatorSubSvc) {
      await this.creatorSubSvc.handleCallback(payload);
      return;
    }

    // Fallback for non-subscription PalmPesa payments
    switch (paymentStatus ?? event.eventType) {
      case 'COMPLETED':
      case 'payment.completed':
        this.logger.log(`PalmPesa payment completed: order=${payload.order_id}`);
        break;
      case 'FAILED':
      case 'payment.failed':
        this.logger.warn(`PalmPesa payment failed: order=${payload.order_id}`);
        break;
      default:
        this.logger.debug(`PalmPesa: unhandled status "${paymentStatus ?? event.eventType}"`);
    }
  }

  private async handleMpesa(event: WebhookEvent): Promise<void> {
    const { eventType, payload } = event;
    // M-Pesa C2B / B2C callbacks use different field names
    const ref = payload['BillRefNumber'] ?? payload['TransID'] ?? payload['reference'] ?? '—';
    const amount = payload['TransAmount'] ?? payload['amount'] ?? '—';
    this.logger.log(`M-Pesa ${eventType}: ref=${String(ref)} amount=${String(amount)}`);

    switch (eventType) {
      case 'c2b.payment':
      case 'payment.completed':
        // TODO: credit wallet by matching BillRefNumber to an order/invoice
        break;
      case 'b2c.result':
        // TODO: mark payout as completed
        break;
      default:
        this.logger.debug(`M-Pesa: unhandled event type "${eventType}"`);
    }
  }

  private async handleStripe(event: WebhookEvent): Promise<void> {
    const { eventType, payload } = event;
    this.logger.log(`Stripe ${eventType}: id=${payload['id'] ?? '—'}`);

    switch (eventType) {
      case 'payment_intent.succeeded':
        // TODO: credit wallet / fulfill order
        break;
      case 'payment_intent.payment_failed':
        // TODO: mark transaction FAILED, notify user
        break;
      case 'charge.refunded':
        // TODO: reverse transaction
        break;
      case 'invoice.paid':
        // TODO: activate/extend subscription
        break;
      default:
        this.logger.debug(`Stripe: unhandled event type "${eventType}"`);
    }
  }

  private async handleCustom(event: WebhookEvent): Promise<void> {
    this.logger.log(`Custom webhook (${event.provider}/${event.eventType}) persisted — no handler registered`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private normalizeProvider(raw: string): WebhookEvent['provider'] {
    const p = raw.toLowerCase();
    if (p === 'palmpesa') return 'palmpesa';
    if (p === 'mpesa')    return 'mpesa';
    if (p === 'stripe')   return 'stripe';
    return 'custom';
  }
}
