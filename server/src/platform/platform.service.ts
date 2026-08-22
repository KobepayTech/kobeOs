import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeemService } from '../notifications/beem.service';
import { PushService } from '../push/push.service';
import { PlatformDomainEvent, PlatformNotification } from './platform.entity';

export type KobeDomainEventName =
  | 'shop.claimed' | 'product.created' | 'product.updated' | 'product.deleted' | 'product.available' | 'product.unavailable'
  | 'node.online' | 'node.offline' | 'product.swiped_right' | 'cart.order_submitted'
  | 'lite.quota_warning' | 'lite.quota_reached' | 'merchant.upgraded'
  | 'hotel.booking_created' | 'hotel.payment_detected' | 'hotel.payment_matched' | 'hotel.daily_close'
  | 'lala.stay_completed' | 'hotel.loyalty_earned' | 'lala.reward_earned'
  | 'sms.transaction_detected' | 'accounting.question_created' | 'accounting.question_answered'
  | 'accounting.call_triggered' | 'accounting.transaction_classified' | 'accounting.daily_close_completed'
  | 'transit.bus_registered' | 'transit.trip_created' | 'transit.trip_started' | 'transit.plate_detected'
  | 'transit.checkpoint_passed' | 'transit.eta_updated' | 'transit.arrival_alert_triggered'
  | 'transit.fee_due' | 'transit.fee_paid' | 'transit.fee_overdue' | 'transit.compliance_changed'
  | 'transit.unpaid_bus_detected' | 'transit.enforcement_alert_created'
  | 'transit.government_share_accrued' | 'transit.government_settlement_created'
  | 'transit.government_settlement_completed' | 'transit.payment_dispute_created' | 'transit.exemption_created';

@Injectable()
export class PlatformEventsService {
  constructor(@InjectRepository(PlatformDomainEvent) private readonly events: Repository<PlatformDomainEvent>) {}

  emit(input: { ownerId?: string | null; eventName: KobeDomainEventName; aggregateType: string; aggregateId?: string | null; payload?: Record<string, unknown> }) {
    return this.events.save(this.events.create({
      ownerId: input.ownerId ?? null,
      eventName: input.eventName,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId ?? null,
      payload: input.payload ?? {},
      occurredAt: new Date(),
      status: 'RECORDED',
      attempts: 0,
    }));
  }

  list(ownerId: string, limit = 200) {
    return this.events.find({ where: { ownerId }, order: { occurredAt: 'DESC' }, take: Math.min(500, Math.max(1, limit)) });
  }
}

@Injectable()
export class PlatformNotificationService {
  private readonly logger = new Logger(PlatformNotificationService.name);
  constructor(
    @InjectRepository(PlatformNotification) private readonly notifications: Repository<PlatformNotification>,
    private readonly beem: BeemService,
    private readonly push: PushService,
  ) {}

  async send(input: {
    ownerId?: string | null; recipientKey?: string; phone?: string; email?: string;
    title: string; body: string; actionUrl?: string; channels?: Array<'IN_APP' | 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL' | 'VOICE'>;
  }) {
    const channels = input.channels?.length ? input.channels : ['IN_APP'];
    const row = await this.notifications.save(this.notifications.create({
      ownerId: input.ownerId ?? null,
      recipientKey: input.recipientKey ?? input.phone ?? input.email ?? '',
      phone: input.phone ?? '', email: input.email ?? '', title: input.title, body: input.body,
      actionUrl: input.actionUrl ?? '', requestedChannels: channels, delivery: { IN_APP: 'SAVED' },
    }));
    const delivery: Record<string, unknown> = { IN_APP: 'SAVED' };
    const jobs: Array<Promise<void>> = [];
    if (input.phone && channels.includes('SMS')) jobs.push(this.beem.sendSms(input.phone, input.body).then((r) => { delivery.SMS = r; }));
    if (input.phone && channels.includes('WHATSAPP')) jobs.push(this.beem.sendWhatsApp(input.phone, input.body).then((r) => { delivery.WHATSAPP = r; }));
    if (input.phone && channels.includes('PUSH')) jobs.push(this.push.sendToPhone(input.phone, { title: input.title, body: input.body, url: input.actionUrl || '/', tag: `kobe-${row.id}` }).then(() => { delivery.PUSH = 'SENT'; }));
    if (channels.includes('EMAIL')) delivery.EMAIL = input.email ? 'QUEUED_FOR_PROVIDER' : 'NO_EMAIL';
    if (channels.includes('VOICE')) delivery.VOICE = input.phone ? 'QUEUED_FOR_PROVIDER' : 'NO_PHONE';
    await Promise.allSettled(jobs);
    row.delivery = delivery;
    await this.notifications.save(row).catch((e) => this.logger.warn(`Notification delivery audit failed: ${(e as Error).message}`));
    return row;
  }

  list(ownerId: string) { return this.notifications.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 250 }); }
}
