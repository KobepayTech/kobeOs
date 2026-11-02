import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { BUSINESS_EVENT_NAMES, businessSignal, type BusinessEventName } from './business-events';
import { PlatformBusinessSignal, PlatformDomainEvent } from './platform.entity';

/** Durable, data-only consumer for the Brain inbox. Publishing here means the
 * signal was committed, not that money moved or an external service received it. */
@Injectable()
export class BusinessEventDeliveryService {
  private readonly logger = new Logger(BusinessEventDeliveryService.name);
  constructor(private readonly db: DataSource) {}

  async deliverOne(): Promise<boolean> {
    return this.db.transaction(async tx => {
      const repo = tx.getRepository(PlatformDomainEvent);
      const event = await repo.createQueryBuilder('e').setLock('pessimistic_write').setOnLocked('skip_locked')
        .where('e.ownerId IS NOT NULL').andWhere('e.eventName IN (:...names)', { names: [...BUSINESS_EVENT_NAMES] })
        .andWhere('e.status IN (:...states)', { states: ['RECORDED', 'FAILED'] }).andWhere('e.attempts < 8')
        .andWhere('(e.nextAttemptAt IS NULL OR e.nextAttemptAt <= CURRENT_TIMESTAMP)')
        .orderBy('e.occurredAt', 'ASC').take(1).getOne();
      if (!event) return false;
      event.attempts++;
      await tx.query('SAVEPOINT brain_projection');
      try {
        if (event.schemaVersion !== 1) throw new Error('Unsupported business event schema');
        const signal = businessSignal(event.eventName as BusinessEventName, event.payload);
        await tx.getRepository(PlatformBusinessSignal).createQueryBuilder().insert().values({
          ownerId: event.ownerId!, sourceEventId: event.id, eventName: event.eventName,
          category: signal.category, severity: signal.severity, summary: signal.summary, data: () => ':signalData',
        }).setParameter('signalData', JSON.stringify(signal.data)).orIgnore().execute();
        event.status = 'PUBLISHED'; event.publishedAt = new Date(); event.lastError = null; event.nextAttemptAt = null;
      } catch {
        await tx.query('ROLLBACK TO SAVEPOINT brain_projection');
        event.status = 'FAILED'; event.lastError = 'Business signal projection failed; inspect the source event.';
        event.nextAttemptAt = new Date(Date.now() + Math.min(3600, 5 * 2 ** (event.attempts - 1)) * 1000);
        this.logger.warn(`Business event ${event.id} projection failed (attempt ${event.attempts}).`);
      }
      await tx.query('RELEASE SAVEPOINT brain_projection');
      await repo.save(event);
      return true;
    });
  }
  @Interval(5000)
  async tick() {
    if (process.env.NODE_ENV === 'test') return;
    try { for (let i = 0; i < 20 && await this.deliverOne(); i++) { /* bounded batch */ } }
    catch { this.logger.warn('Business event delivery unavailable; recorded events remain queued.'); }
  }
}
