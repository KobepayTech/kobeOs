import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvent } from './webhook.entity';
import { PalmPesaCallback } from '../creators/palmpesa.service';
import { HotelBooking, HotelRoom } from '../hotel/hotel.entity';
import { HotelWalletService } from '../hotel/hotel-wallet.service';
import { PlatformEventsService } from '../platform/platform.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  private creatorSubSvc?: import('../creators/creator-subscription.service').CreatorSubscriptionService;
  private licenseSvc?: import('../license/license.service').LicenseService;
  private mobileSubSvc?: import('../mobile-subscription/mobile-subscription.service').MobileSubscriptionService;
  private appMarketplaceSvc?: import('../app-marketplace/app-marketplace.service').AppMarketplaceService;

  setCreatorSubscriptionService(
    svc: import('../creators/creator-subscription.service').CreatorSubscriptionService,
  ) {
    this.creatorSubSvc = svc;
  }

  setLicenseService(svc: import('../license/license.service').LicenseService) {
    this.licenseSvc = svc;
  }

  setMobileSubscriptionService(
    svc: import('../mobile-subscription/mobile-subscription.service').MobileSubscriptionService,
  ) {
    this.mobileSubSvc = svc;
  }

  setAppMarketplaceService(
    svc: import('../app-marketplace/app-marketplace.service').AppMarketplaceService,
  ) {
    this.appMarketplaceSvc = svc;
  }

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly repo: Repository<WebhookEvent>,
    @InjectRepository(HotelBooking)
    private readonly bookings: Repository<HotelBooking>,
    @InjectRepository(HotelRoom)
    private readonly rooms: Repository<HotelRoom>,
    private readonly hotelWallet: HotelWalletService,
    private readonly events: PlatformEventsService,
  ) {}

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

  private async handlePalmPesa(event: WebhookEvent): Promise<void> {
    const payload = event.payload as unknown as PalmPesaCallback;
    const paymentStatus = payload.payment_status
      ?? (event.eventType === 'payment.completed' ? 'COMPLETED' : undefined);

    this.logger.log(
      `PalmPesa callback: order=${payload.order_id ?? '—'} status=${paymentStatus ?? event.eventType}`,
    );

    const ref = payload.reference ?? '';
    if (ref.startsWith('lic_') && this.licenseSvc) {
      await this.licenseSvc.handleCallback(payload);
      return;
    }

    if (ref.startsWith('msub_') && this.mobileSubSvc) {
      await this.mobileSubSvc.handleCallback(payload);
      return;
    }

    if (ref.startsWith('appsub_') && this.appMarketplaceSvc) {
      await this.appMarketplaceSvc.handlePalmPesaCallback(payload);
      return;
    }

    if (payload.order_id) {
      const booking = await this.bookings.findOne({ where: { palmPesaOrderId: payload.order_id } });
      if (booking) {
        await this.events.emit({ ownerId: booking.ownerId, eventName: 'hotel.payment_detected', aggregateType: 'HotelBooking', aggregateId: booking.id, payload: { hotelId: booking.hotelId, orderId: payload.order_id, paymentStatus: paymentStatus ?? 'UNKNOWN' } });
        if (paymentStatus === 'COMPLETED') {
          await this.bookings.update({ id: booking.id }, { status: 'CONFIRMED' });
          try {
            await this.hotelWallet.creditForBooking(booking.ownerId, {
              bookingId: booking.id,
              amount: Number(booking.totalAmount) || 0,
              currency: booking.currency || 'TZS',
              hotelId: booking.hotelId ?? null,
              description: `Room booking ${booking.id} paid online`,
            });
          } catch (e) {
            this.logger.error(`Wallet credit failed for booking ${booking.id}: ${(e as Error).message}`);
          }
          await this.events.emit({ ownerId: booking.ownerId, eventName: 'hotel.payment_matched', aggregateType: 'HotelBooking', aggregateId: booking.id, payload: { hotelId: booking.hotelId, orderId: payload.order_id, amount: booking.totalAmount, currency: booking.currency } });
          this.logger.log(`Hotel booking ${booking.id} auto-confirmed + wallet credited (owner ${booking.ownerId}).`);
        } else if (paymentStatus === 'FAILED') {
          await this.bookings.update({ id: booking.id }, { status: 'CANCELLED' });
          const room = await this.rooms.findOne({ where: { ownerId: booking.ownerId, id: booking.roomId } });
          // A future reservation no longer globally marks a room reserved. Never
          // turn an occupied/cleaning/maintenance room into "available" because
          // an unrelated future payment failed; only release this booking's
          // active reservation marker.
          if (room?.status === 'reserved') {
            await this.rooms.update({ ownerId: booking.ownerId, id: booking.roomId }, { status: 'available' });
          }
          this.logger.warn(`Hotel booking ${booking.id} cancelled — payment failed.`);
        }
        return;
      }
    }

    if (payload.order_id && this.creatorSubSvc) {
      await this.creatorSubSvc.handleCallback(payload);
      return;
    }

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
    const ref = payload['BillRefNumber'] ?? payload['TransID'] ?? payload['reference'] ?? '—';
    const amount = payload['TransAmount'] ?? payload['amount'] ?? '—';
    this.logger.log(`M-Pesa ${eventType}: ref=${String(ref)} amount=${String(amount)}`);

    switch (eventType) {
      case 'c2b.payment':
      case 'payment.completed':
        // M-Pesa C2B matching is a separate provider integration and is not
        // presented as a live Hotel payment option until a reference mapper exists.
        break;
      case 'b2c.result':
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
      case 'payment_intent.payment_failed':
      case 'charge.refunded':
      case 'invoice.paid':
        // Stripe is not exposed as a working Hotel payment channel until its
        // Hotel-specific fulfillment adapter is implemented.
        break;
      default:
        this.logger.debug(`Stripe: unhandled event type "${eventType}"`);
    }
  }

  private async handleCustom(event: WebhookEvent): Promise<void> {
    this.logger.log(`Custom webhook (${event.provider}/${event.eventType}) persisted — no handler registered`);
  }

  private normalizeProvider(raw: string): WebhookEvent['provider'] {
    const p = raw.toLowerCase();
    if (p === 'palmpesa') return 'palmpesa';
    if (p === 'mpesa')    return 'mpesa';
    if (p === 'stripe')   return 'stripe';
    return 'custom';
  }
}
