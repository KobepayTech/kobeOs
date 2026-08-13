import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { InboundPayment, SmsDevice } from './mobile-money.entity';
import { parsePaymentSms } from './payment-sms-parser';

export interface IngestInput { deviceId?: string; gatewayKey: string; message: string }
export interface IngestResult {
  ok: boolean;
  status: InboundPayment['status'] | 'REJECTED';
  id?: string;
  transactionId?: string;
  amount?: number;
  direction?: string;
  consumedBy?: string;
  reason?: string;
}

/**
 * A consumer reacts to a newly-received transaction and may claim it. The first
 * registered consumer whose name matches the device `purpose` runs; returning
 * `{ consumed: true }` marks the transaction PROCESSED. Modules register their
 * own consumer (school deposits, live-sale settlement, …), so the SMS bridge is
 * a shared capability rather than a school-only feature.
 */
export type PaymentConsumer = (
  ownerId: string, txn: InboundPayment,
) => Promise<{ consumed: boolean; ref?: string } | void>;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex'); const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Injectable()
export class MobileMoneyService {
  private readonly logger = new Logger(MobileMoneyService.name);
  private readonly consumers = new Map<string, PaymentConsumer>();

  constructor(
    @InjectRepository(SmsDevice) private readonly devices: Repository<SmsDevice>,
    @InjectRepository(InboundPayment) private readonly inbound: Repository<InboundPayment>,
  ) {}

  /** Modules call this (typically in onModuleInit) to handle a device purpose. */
  registerConsumer(purpose: string, fn: PaymentConsumer) {
    this.consumers.set(purpose, fn);
    this.logger.log(`Payment consumer registered for purpose "${purpose}"`);
  }

  // ── Device registry ────────────────────────────────────────────────────────
  async registerDevice(
    ownerId: string, dto: { deviceId: string; label?: string; purpose?: string; gatewayKey?: string },
  ): Promise<{ device: SmsDevice; gatewayKey: string }> {
    if (!dto.deviceId?.trim()) throw new BadRequestException('deviceId is required');
    const existing = await this.devices.findOne({ where: { deviceId: dto.deviceId } });
    if (existing && existing.ownerId !== ownerId) throw new BadRequestException('Device id already in use');
    const gatewayKey = dto.gatewayKey?.trim() || randomBytes(24).toString('base64url');
    const device = existing ?? this.devices.create({ ownerId, deviceId: dto.deviceId });
    device.label = dto.label ?? device.label ?? '';
    device.purpose = dto.purpose ?? device.purpose ?? 'general';
    device.gatewayKeyHash = sha256(gatewayKey);
    device.active = true;
    const saved = await this.devices.save(device);
    // The plain key is returned ONCE at registration and never stored.
    return { device: saved, gatewayKey };
  }

  listDevices(ownerId: string) {
    return this.devices.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  listInbound(ownerId: string, status?: InboundPayment['status']) {
    return this.inbound.find({
      where: { ownerId, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' }, take: 300,
    });
  }

  // ── Ingest ────────────────────────────────────────────────────────────────
  /**
   * Ingest a raw forwarded SMS. Resolves the owner from the device registry
   * (or the legacy KP_MPESA_* env for single-tenant), parses, dedupes on the
   * transaction id, stores it, and dispatches to the matching consumer.
   */
  async ingest(input: IngestInput): Promise<IngestResult> {
    const { ownerId, purpose, deviceId } = await this.resolveDevice(input);

    const parsed = parsePaymentSms(input.message);
    if (!parsed) return { ok: false, status: 'REJECTED', reason: 'Not a recognisable payment SMS' };

    const existing = await this.inbound.findOne({ where: { ownerId, transactionId: parsed.transactionId } });
    if (existing) {
      return { ok: true, status: 'DUPLICATE', id: existing.id, transactionId: parsed.transactionId };
    }

    const status: InboundPayment['status'] = parsed.direction === 'RECEIVED' ? 'RECEIVED' : 'IGNORED';
    let txn: InboundPayment;
    try {
      txn = await this.inbound.save(this.inbound.create({
        ownerId, deviceId,
        transactionId: parsed.transactionId,
        provider: parsed.provider, direction: parsed.direction,
        amount: parsed.amount, currency: 'TZS',
        senderName: parsed.senderName, senderPhone: parsed.senderPhone,
        reference: parsed.reference, account: parsed.account,
        status, rawMessage: parsed.raw,
      }));
    } catch {
      const again = await this.inbound.findOne({ where: { ownerId, transactionId: parsed.transactionId } });
      if (again) return { ok: true, status: 'DUPLICATE', id: again.id, transactionId: parsed.transactionId };
      throw new BadRequestException('Failed to record transaction');
    }

    if (deviceId) {
      await this.devices.update({ deviceId }, { lastSeenAt: new Date() }).catch(() => undefined);
    }

    // Only genuine incoming money is dispatched to consumers.
    if (status === 'RECEIVED') {
      const consumer = this.consumers.get(purpose) ?? this.consumers.get('general');
      if (consumer) {
        try {
          const res = await consumer(ownerId, txn);
          if (res?.consumed) {
            txn.status = 'PROCESSED';
            txn.consumedBy = purpose;
            txn.consumedRef = res.ref ?? '';
            await this.inbound.save(txn);
          }
        } catch (e) {
          this.logger.warn(`Consumer "${purpose}" failed for ${parsed.transactionId}: ${(e as Error).message}`);
        }
      }
    }

    return {
      ok: true, status: txn.status, id: txn.id,
      transactionId: parsed.transactionId, amount: parsed.amount,
      direction: parsed.direction, consumedBy: txn.consumedBy || undefined,
    };
  }

  private async resolveDevice(input: IngestInput): Promise<{ ownerId: string; purpose: string; deviceId: string }> {
    const key = input.gatewayKey?.trim();
    if (!key) throw new ForbiddenException('Missing gateway key');

    if (input.deviceId) {
      const device = await this.devices.findOne({ where: { deviceId: input.deviceId, active: true } });
      if (device) {
        if (!safeEqualHex(sha256(key), device.gatewayKeyHash)) throw new ForbiddenException('Invalid gateway key');
        return { ownerId: device.ownerId, purpose: device.purpose || 'general', deviceId: device.deviceId };
      }
    }

    // Legacy single-tenant fallback (pre-registry deployments).
    const envKey = process.env.KP_MPESA_GATEWAY_KEY;
    const envOwner = process.env.KP_MPESA_OWNER_ID;
    if (envKey && envOwner && safeEqualHex(sha256(key), sha256(envKey))) {
      return { ownerId: envOwner, purpose: 'kobepay-pro', deviceId: input.deviceId || 'legacy' };
    }
    throw new ForbiddenException('Unknown device or invalid gateway key');
  }
}
