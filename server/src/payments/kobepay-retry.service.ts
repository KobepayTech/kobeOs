import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KobepayDispatchAttempt } from './kobepay-dispatch.entity';

/** Exponential back-off: 1m → 5m → 30m → 2h → 12h, then exhausted. */
const BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length;

@Injectable()
export class KobepayRetryQueueService {
  private readonly log = new Logger(KobepayRetryQueueService.name);
  private httpClient: typeof fetch = (i, init) => fetch(i, init);

  constructor(
    @InjectRepository(KobepayDispatchAttempt)
    private readonly repo: Repository<KobepayDispatchAttempt>,
  ) {}

  setHttpClient(client: typeof fetch) { this.httpClient = client; }

  list(uid: string) {
    return this.repo.find({ where: { ownerId: uid }, order: { createdAt: 'DESC' }, take: 200 });
  }

  pendingCount(uid: string) {
    return this.repo.count({ where: { ownerId: uid, status: 'pending' } });
  }

  /** Record a successful dispatch (for audit / delivery history). */
  recordSuccess(uid: string, deposit: { id: string }, customer: { id: string; erpEndpointUrl: string; erpApiKey: string }, payload: Record<string, unknown>, httpStatus: number) {
    return this.repo.save(this.repo.create({
      ownerId: uid,
      depositId: deposit.id,
      customerId: customer.id,
      endpointUrl: customer.erpEndpointUrl,
      payload,
      apiKey: customer.erpApiKey,
      attemptCount: 1,
      lastTriedAt: new Date(),
      nextRetryAt: new Date(),
      lastStatus: httpStatus,
      lastError: '',
      status: 'succeeded',
    }));
  }

  /** Queue a retry for an inline dispatch that just failed. */
  enqueueFailure(
    uid: string,
    deposit: { id: string },
    customer: { id: string; erpEndpointUrl: string; erpApiKey: string },
    payload: Record<string, unknown>,
    failure: { status?: number; error: string },
  ) {
    const nextRetryAt = new Date(Date.now() + BACKOFF_SECONDS[0] * 1000);
    return this.repo.save(this.repo.create({
      ownerId: uid,
      depositId: deposit.id,
      customerId: customer.id,
      endpointUrl: customer.erpEndpointUrl,
      payload,
      apiKey: customer.erpApiKey,
      attemptCount: 1,
      lastTriedAt: new Date(),
      nextRetryAt,
      lastStatus: failure.status ?? 0,
      lastError: failure.error,
      status: 'pending',
    }));
  }

  /** Force the next retry to fire immediately. */
  async forceRetry(uid: string, id: string) {
    const row = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!row) throw new NotFoundException();
    if (row.status === 'succeeded') return row;
    row.nextRetryAt = new Date();
    row.status = 'pending';
    return this.repo.save(row);
  }

  /**
   * Scheduled worker: every minute, sweep every owner's pending rows
   * whose nextRetryAt has passed. On success → mark succeeded. On
   * failure → bump attemptCount, schedule the next back-off slot, or
   * mark exhausted if we ran out of attempts.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    const due = await this.repo.find({
      where: { status: 'pending', nextRetryAt: LessThanOrEqual(new Date()) },
      take: 50,
    });
    for (const row of due) {
      await this.attempt(row);
    }
  }

  private async attempt(row: KobepayDispatchAttempt) {
    row.status = 'in_flight';
    await this.repo.save(row);
    try {
      const res = await this.httpClient(row.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${row.apiKey}` },
        body: JSON.stringify(row.payload),
      });
      row.attemptCount += 1;
      row.lastTriedAt = new Date();
      row.lastStatus = res.status;
      if (res.ok) {
        row.status = 'succeeded';
        row.lastError = '';
      } else {
        const text = await res.text().catch(() => '');
        row.lastError = text || res.statusText;
        row.status = row.attemptCount >= MAX_ATTEMPTS ? 'exhausted' : 'pending';
        if (row.status === 'pending') {
          const slot = Math.min(row.attemptCount, BACKOFF_SECONDS.length - 1);
          row.nextRetryAt = new Date(Date.now() + BACKOFF_SECONDS[slot] * 1000);
        }
      }
    } catch (err) {
      row.attemptCount += 1;
      row.lastTriedAt = new Date();
      row.lastError = err instanceof Error ? err.message : String(err);
      row.status = row.attemptCount >= MAX_ATTEMPTS ? 'exhausted' : 'pending';
      if (row.status === 'pending') {
        const slot = Math.min(row.attemptCount, BACKOFF_SECONDS.length - 1);
        row.nextRetryAt = new Date(Date.now() + BACKOFF_SECONDS[slot] * 1000);
      }
      this.log.warn(`Retry ${row.id} attempt ${row.attemptCount} failed: ${row.lastError}`);
    }
    await this.repo.save(row);
  }
}
