import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  AppEntitlement,
  type AppEntitlementStatus,
} from './app-entitlement.entity';
import { PalmPesaService, type PalmPesaCallback } from '../creators/palmpesa.service';
import { PayPalCheckoutService } from './paypal-checkout.service';

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;
const PAID_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const APP_PRICE_TZS = 25_000;
const APP_PRICE_USD = 10;
const TX_PREFIX = 'appsub_';

export type AppAccess = 'trial' | 'active' | 'expired' | 'pending' | 'failed';

export interface AppEntitlementView {
  appId: string;
  access: AppAccess;
  installedAt: number;
  trialEndsAt: number;
  periodEndsAt: number | null;
  daysRemaining: number;
  priceTzs: number;
  priceUsd: number;
  paymentProviders: {
    palmPesa: boolean;
    paypal: boolean;
  };
}

@Injectable()
export class AppMarketplaceService {
  private readonly logger = new Logger(AppMarketplaceService.name);

  constructor(
    @InjectRepository(AppEntitlement)
    private readonly repo: Repository<AppEntitlement>,
    private readonly palmPesa: PalmPesaService,
    private readonly paypal: PayPalCheckoutService,
  ) {}

  private appName(appId: string): string {
    return appId.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  private view(record: AppEntitlement, now = Date.now()): AppEntitlementView {
    const paid = !!record.currentPeriodEndsAt && record.currentPeriodEndsAt.getTime() > now;
    const trial = !paid && record.trialEndsAt.getTime() > now;
    let access: AppAccess;
    if (paid) access = 'active';
    else if (trial) access = 'trial';
    else if (record.status === 'pending') access = 'pending';
    else if (record.status === 'failed') access = 'failed';
    else access = 'expired';

    return {
      appId: record.appId,
      access,
      installedAt: record.installedAt.getTime(),
      trialEndsAt: record.trialEndsAt.getTime(),
      periodEndsAt: record.currentPeriodEndsAt?.getTime() ?? null,
      daysRemaining: access === 'trial'
        ? Math.max(0, Math.ceil((record.trialEndsAt.getTime() - now) / 86_400_000))
        : access === 'active' && record.currentPeriodEndsAt
          ? Math.max(0, Math.ceil((record.currentPeriodEndsAt.getTime() - now) / 86_400_000))
          : 0,
      priceTzs: APP_PRICE_TZS,
      priceUsd: APP_PRICE_USD,
      paymentProviders: {
        palmPesa: this.palmPesa.isConfigured(),
        paypal: this.paypal.isConfigured(),
      },
    };
  }

  private async syncStatus(record: AppEntitlement): Promise<AppEntitlement> {
    const current = this.view(record);
    const status: AppEntitlementStatus =
      current.access === 'trial' ? 'trialing' :
        current.access === 'active' ? 'active' :
          current.access === 'pending' ? 'pending' :
            current.access === 'failed' ? 'failed' : 'expired';
    if (record.status !== status) {
      record.status = status;
      return this.repo.save(record);
    }
    return record;
  }

  async list(userId: string): Promise<AppEntitlementView[]> {
    const records = await this.repo.find({ where: { userId }, order: { installedAt: 'ASC' } });
    return Promise.all(records.map(async (record) => this.view(await this.syncStatus(record))));
  }

  async install(userId: string, appId: string): Promise<AppEntitlementView> {
    const existing = await this.repo.findOne({ where: { userId, appId } });
    if (existing) return this.view(await this.syncStatus(existing));

    const now = Date.now();
    const record = await this.repo.save(this.repo.create({
      userId,
      appId,
      status: 'trialing',
      installedAt: new Date(now),
      trialEndsAt: new Date(now + TRIAL_MS),
      amountTzs: 0,
      amountUsd: 0,
    }));
    this.logger.log(`Started 14-day trial for ${userId}/${appId}.`);
    return this.view(record);
  }

  private async requireEntitlement(userId: string, appId: string): Promise<AppEntitlement> {
    const record = await this.repo.findOne({ where: { userId, appId } });
    if (!record) throw new NotFoundException('Install this app before purchasing it.');
    return record;
  }

  async initiatePalmPesa(userId: string, appId: string, msisdn: string) {
    const record = await this.requireEntitlement(userId, appId);
    const transactionId = `${TX_PREFIX}${randomUUID()}`;
    const { order_id } = await this.palmPesa.initiatePayment({
      name: `KobeOS ${this.appName(appId)}`,
      email: `${userId}@kobeos.local`,
      phone: msisdn,
      amountTzs: APP_PRICE_TZS,
      transactionId,
      description: `${this.appName(appId)} — 30-day app subscription`,
    });
    record.status = 'pending';
    record.provider = 'palmpesa';
    record.transactionId = transactionId;
    record.palmPesaOrderId = order_id;
    record.amountTzs = APP_PRICE_TZS;
    record.callbackPayload = null;
    record.palmPesaTransId = null;
    record.channel = null;
    await this.repo.save(record);
    return { transactionId, orderId: order_id, amount: APP_PRICE_TZS, appId };
  }

  async initiatePayPal(userId: string, appId: string) {
    const record = await this.requireEntitlement(userId, appId);
    const result = await this.paypal.createOrder({
      appId,
      appName: this.appName(appId),
      amountUsd: APP_PRICE_USD,
      entitlementId: record.id,
    });
    record.status = 'pending';
    record.provider = 'paypal';
    record.paypalOrderId = result.orderId;
    record.transactionId = `paypal_${result.orderId}`;
    record.amountUsd = APP_PRICE_USD;
    record.callbackPayload = null;
    await this.repo.save(record);
    return { ...result, amount: APP_PRICE_USD, currency: 'USD', appId };
  }

  async capturePayPal(userId: string, appId: string, orderId: string) {
    const record = await this.requireEntitlement(userId, appId);
    if (record.paypalOrderId !== orderId) {
      throw new BadRequestException('PayPal order does not match this app.');
    }
    const previousOrder = record.callbackPayload as { status?: string } | null | undefined;
    if (previousOrder?.status === 'COMPLETED') {
      const current = this.view(record);
      return {
        status: current.access,
        appId,
        periodEndsAt: record.currentPeriodEndsAt?.getTime(),
      };
    }
    const order = await this.paypal.captureOrder(orderId);
    if (order.status !== 'COMPLETED') {
      return { status: order.status.toLowerCase(), appId };
    }
    this.activate(record);
    record.callbackPayload = order as unknown as Record<string, unknown>;
    await this.repo.save(record);
    return { status: 'active', appId, periodEndsAt: record.currentPeriodEndsAt!.getTime() };
  }

  async paymentStatus(userId: string, transactionId: string) {
    const record = await this.repo.findOne({ where: { userId, transactionId } });
    if (!record) throw new NotFoundException('Payment transaction not found.');
    return {
      status: this.view(await this.syncStatus(record)).access,
      appId: record.appId,
      periodEndsAt: record.currentPeriodEndsAt?.getTime() ?? null,
    };
  }

  private activate(record: AppEntitlement) {
    const now = Date.now();
    const existingEnd = record.currentPeriodEndsAt?.getTime() ?? 0;
    const startsAt = Math.max(now, existingEnd);
    record.status = 'active';
    record.currentPeriodEndsAt = new Date(startsAt + PAID_PERIOD_MS);
  }

  async handlePalmPesaCallback(payload: PalmPesaCallback): Promise<void> {
    const transactionId = payload.reference ?? payload.order_id;
    if (!transactionId?.startsWith(TX_PREFIX)) return;
    const record = await this.repo.findOne({ where: { transactionId } });
    if (!record) {
      this.logger.warn(`App payment callback for unknown transaction ${transactionId}.`);
      return;
    }
    const previousCallback = record.callbackPayload as PalmPesaCallback | null | undefined;
    if (
      payload.payment_status === 'COMPLETED' &&
      previousCallback?.payment_status === 'COMPLETED'
    ) {
      this.logger.log(`Ignoring duplicate app payment callback for ${transactionId}.`);
      return;
    }
    record.callbackPayload = payload as unknown as Record<string, unknown>;
    if (payload.payment_status === 'COMPLETED') {
      this.activate(record);
      record.palmPesaTransId = payload.data?.[0]?.transid ?? null;
      record.channel = payload.data?.[0]?.channel ?? null;
    } else if (payload.payment_status === 'FAILED') {
      record.status = 'failed';
    }
    await this.repo.save(record);
  }
}
