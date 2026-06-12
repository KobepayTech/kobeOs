import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { OsLicense, OS_LICENSE_PRICES } from './os-license.entity';
import type { OsLicensePlan } from './os-license.entity';
import { PalmPesaService } from '../creators/palmpesa.service';
import type { PalmPesaCallback } from '../creators/palmpesa.service';
import { InitiateLicenseDto } from './dto/initiate-license.dto';

// ---------------------------------------------------------------------------
// Token helpers — must match the frontend license.ts implementation
// ---------------------------------------------------------------------------

interface LicensePayload {
  userId: string;
  plan: OsLicensePlan;
  issuedAt: number;
  expiresAt: number;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildToken(payload: LicensePayload, secret: string): string {
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac('sha256', secret).update(payloadB64).digest();
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

// ---------------------------------------------------------------------------

const LICENSE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TRIAL_DURATION_MS   =  7 * 24 * 60 * 60 * 1000; //  7 days (free)

/**
 * Sentinel transaction id used by the free-trial path. We don't talk to
 * PalmPesa for trials, so there's nothing to lookup — this prefix lets
 * the rest of the system recognise trial rows without an extra column.
 */
const TRIAL_TX_PREFIX = 'trial-';

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(
    @InjectRepository(OsLicense)
    private readonly repo: Repository<OsLicense>,
    private readonly palmPesa: PalmPesaService,
    private readonly config: ConfigService,
  ) {}

  private get hmacSecret(): string {
    return this.config.get<string>(
      'LICENSE_HMAC_SECRET',
      'kobe-license-secret-change-in-prod',
    );
  }

  // ── Free 7-day trial ──────────────────────────────────────────────────────

  /**
   * Issue a free 7-day trial license to a user. Idempotent — if a trial
   * row already exists for this user we return its status (active token
   * if still valid, "expired" otherwise) so the client never gets two
   * trials. After the trial expires the user is forced through the paid
   * `initiate` flow to keep using KobeOS.
   */
  async startTrial(userId: string): Promise<{ token: string; expiresAt: number; status: 'active' | 'expired'; daysRemaining: number }> {
    // Reuse the existing trial row if there is one.
    const existing = await this.repo.findOne({
      where: { userId, transactionId: TRIAL_TX_PREFIX + userId },
    });

    if (existing) {
      const expiresAtMs = existing.expiresAt?.getTime() ?? 0;
      const stillValid = expiresAtMs > Date.now() && existing.status === 'active' && existing.licenseToken;
      if (stillValid) {
        return {
          token: existing.licenseToken!,
          expiresAt: expiresAtMs,
          status: 'active',
          daysRemaining: Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 86_400_000)),
        };
      }
      // Mark expired so the client can render the paywall and offer paid upgrade.
      if (existing.status !== 'expired') {
        existing.status = 'expired';
        await this.repo.save(existing);
      }
      return { token: '', expiresAt: expiresAtMs, status: 'expired', daysRemaining: 0 };
    }

    // First-time trial — issue immediately, no PalmPesa round-trip.
    const issuedAt = Date.now();
    const expiresAt = new Date(issuedAt + TRIAL_DURATION_MS);
    const token = buildToken(
      { userId, plan: 'trial', issuedAt, expiresAt: expiresAt.getTime() },
      this.hmacSecret,
    );

    const license = this.repo.create({
      userId,
      plan: 'trial',
      amountTzs: 0,
      transactionId: TRIAL_TX_PREFIX + userId,
      status: 'active',
      licenseToken: token,
      expiresAt,
    });
    await this.repo.save(license);

    this.logger.log(`Free trial started for user ${userId} (expires ${expiresAt.toISOString()})`);
    return { token, expiresAt: expiresAt.getTime(), status: 'active', daysRemaining: 7 };
  }

  // ── Initiate payment ──────────────────────────────────────────────────────

  async initiate(userId: string, dto: InitiateLicenseDto) {
    const amount = OS_LICENSE_PRICES[dto.plan];
    const transactionId = `lic_${randomUUID()}`;

    const { order_id } = await this.palmPesa.initiatePayment({
      name: 'KobeOS User',
      email: `${userId}@kobeos.local`,
      phone: dto.msisdn,
      amountTzs: amount,
      transactionId,
      description: `KobeOS ${dto.plan} license — 30 days`,
    });

    const license = this.repo.create({
      userId,
      plan: dto.plan,
      amountTzs: amount,
      transactionId,
      palmPesaOrderId: order_id,
      status: 'pending',
    });
    await this.repo.save(license);

    return { transactionId, orderId: order_id, amount, plan: dto.plan };
  }

  // ── Handle PalmPesa callback ──────────────────────────────────────────────

  async handleCallback(payload: PalmPesaCallback): Promise<void> {
    // PalmPesa sends the reference (our transactionId) in the callback
    const transactionId = payload.reference ?? payload.order_id;
    if (!transactionId) return;

    const license = await this.repo.findOne({ where: { transactionId } });
    if (!license) {
      this.logger.warn(`License callback for unknown transactionId: ${transactionId}`);
      return;
    }

    license.callbackPayload = payload as unknown as Record<string, unknown>;

    if (payload.payment_status === 'COMPLETED') {
      const now = Date.now();
      const expiresAt = new Date(now + LICENSE_DURATION_MS);

      const tokenPayload: LicensePayload = {
        userId: license.userId,
        plan: license.plan,
        issuedAt: now,
        expiresAt: expiresAt.getTime(),
      };

      license.licenseToken = buildToken(tokenPayload, this.hmacSecret);
      license.palmPesaTransId = payload.data?.[0]?.transid ?? null;
      license.channel = payload.data?.[0]?.channel ?? null;
      license.expiresAt = expiresAt;
      license.status = 'active';

      this.logger.log(`License activated for user ${license.userId} (plan: ${license.plan})`);
    } else if (payload.payment_status === 'FAILED') {
      license.status = 'failed';
    }

    await this.repo.save(license);
  }

  // ── Poll for activation (client polls after USSD push) ───────────────────

  async getActiveLicense(userId: string): Promise<{ token: string; expiresAt: number } | null> {
    const license = await this.repo.findOne({
      where: { userId, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    if (!license || !license.licenseToken || !license.expiresAt) return null;

    // Expire if past expiresAt
    if (license.expiresAt.getTime() < Date.now()) {
      license.status = 'expired';
      await this.repo.save(license);
      return null;
    }

    return {
      token: license.licenseToken,
      expiresAt: license.expiresAt.getTime(),
    };
  }

  // ── Status check (for UI polling) ────────────────────────────────────────

  async getPendingStatus(userId: string, transactionId: string) {
    const license = await this.repo.findOne({ where: { userId, transactionId } });
    if (!license) throw new NotFoundException('Transaction not found');

    const result: Record<string, unknown> = { status: license.status };

    if (license.status === 'active' && license.licenseToken) {
      result['token'] = license.licenseToken;
      result['expiresAt'] = license.expiresAt?.getTime();
    }

    return result;
  }

  // ── Renew: issue a new payment for the same plan ─────────────────────────

  async renew(userId: string, msisdn: string): Promise<ReturnType<LicenseService['initiate']>> {
    const current = await this.repo.findOne({
      where: { userId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    if (!current) throw new BadRequestException('No active license to renew');
    return this.initiate(userId, { plan: current.plan, msisdn });
  }
}
