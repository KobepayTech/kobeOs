import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from './push.entity';
import { BeemService } from '../notifications/beem.service';

/**
 * Web Push (VAPID) fan-out service. Persists per-phone subscriptions
 * and sends notifications via the `web-push` npm package. Used as
 * an SMS-cost replacement for lifecycle pings — falls back to SMS
 * silently when a phone has no active push subscription.
 *
 * VAPID keys via env:
 *   VAPID_PUBLIC_KEY    — Base64URL P-256 public key (exposed to clients)
 *   VAPID_PRIVATE_KEY   — paired private key (server-side only)
 *   VAPID_SUBJECT       — mailto: or https:// for the push service to
 *                          contact you about abuse (e.g. mailto:ops@kobeapptz.com)
 *
 * Generate fresh keys with:  npx web-push generate-vapid-keys
 *
 * When VAPID env vars are unset the service is a no-op (logs once on
 * boot, then silently returns from every send). Lets the rest of the
 * app keep working on installs that haven't generated keys yet.
 */
const MAX_FAILURES_BEFORE_DELETE = 3;
const TTL_SECONDS = 24 * 60 * 60;     // notification valid for 24h max

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger('PushService');
  private webpush: typeof import('web-push') | null = null;
  private vapidPublic = '';
  private vapidPrivate = '';
  private subject = '';

  constructor(
    @InjectRepository(PushSubscription) private readonly subs: Repository<PushSubscription>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.vapidPublic = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    this.vapidPrivate = this.config.get<string>('VAPID_PRIVATE_KEY') ?? '';
    this.subject = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:ops@kobeapptz.com';
    if (!this.vapidPublic || !this.vapidPrivate) {
      this.logger.warn(
        'VAPID keys not configured. Web Push disabled. Generate with `npx web-push generate-vapid-keys`.',
      );
      return;
    }
    try {
      const mod = (await import('web-push' as string)) as typeof import('web-push');
      mod.setVapidDetails(this.subject, this.vapidPublic, this.vapidPrivate);
      this.webpush = mod;
      this.logger.log('Web Push ready (VAPID configured).');
    } catch (err) {
      this.logger.warn(`web-push failed to load: ${(err as Error).message}`);
    }
  }

  /** True when the server can send a push. Exposed via /push/info so
   *  the client only renders the subscribe button when it'll work. */
  isConfigured(): boolean {
    return !!(this.webpush && this.vapidPublic && this.vapidPrivate);
  }

  publicKey(): string { return this.vapidPublic; }

  async subscribe(input: {
    phone: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<PushSubscription> {
    const phone = BeemService.normalizePhone(input.phone) ?? '';
    if (!phone) throw new Error('Invalid phone');
    // Upsert by (phone, endpoint).
    const existing = await this.subs.findOne({ where: { phone, endpoint: input.endpoint } });
    if (existing) {
      existing.p256dh = input.p256dh;
      existing.auth   = input.auth;
      existing.userAgent = input.userAgent ?? existing.userAgent;
      existing.failureCount = 0;
      return this.subs.save(existing);
    }
    return this.subs.save(this.subs.create({
      phone,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? '',
      failureCount: 0,
    }));
  }

  async unsubscribe(phone: string, endpoint: string) {
    const normalised = BeemService.normalizePhone(phone) ?? '';
    if (!normalised) return { removed: 0 };
    const result = await this.subs.delete({ phone: normalised, endpoint });
    return { removed: result.affected ?? 0 };
  }

  /** Send to every subscription bound to the given phone. Returns
   *  per-subscription send status; auto-deletes endpoints that have
   *  failed too many times in a row (the customer revoked permission
   *  or wiped the browser). */
  async sendToPhone(phone: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<{ sent: number; failed: number }> {
    if (!this.webpush) return { sent: 0, failed: 0 };
    const normalised = BeemService.normalizePhone(phone) ?? '';
    if (!normalised) return { sent: 0, failed: 0 };
    const targets = await this.subs.find({ where: { phone: normalised } });
    if (targets.length === 0) return { sent: 0, failed: 0 };

    const body = JSON.stringify(payload);
    let sent = 0, failed = 0;
    await Promise.allSettled(targets.map(async (s) => {
      try {
        await this.webpush!.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: TTL_SECONDS },
        );
        s.lastSentAt = new Date();
        s.failureCount = 0;
        await this.subs.save(s);
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        // 404 / 410 = subscription is gone permanently → delete immediately.
        // Other errors might be transient (502, timeout); bump the counter
        // and only delete after MAX_FAILURES_BEFORE_DELETE.
        if (status === 404 || status === 410) {
          await this.subs.delete({ id: s.id });
        } else {
          s.failureCount = (s.failureCount ?? 0) + 1;
          if (s.failureCount >= MAX_FAILURES_BEFORE_DELETE) {
            await this.subs.delete({ id: s.id });
          } else {
            await this.subs.save(s);
          }
        }
        this.logger.warn(`Push to ${s.endpoint.slice(-12)} failed${status ? ` (${status})` : ''}: ${(err as Error).message}`);
      }
    }));
    return { sent, failed };
  }
}
