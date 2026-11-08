import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { BeemService } from '../notifications/beem.service';
import { CtzSmsOutbox } from './cargotz-trip.entity';

@Injectable()
export class CargoTzSmsService {
  private readonly logger = new Logger(CargoTzSmsService.name);
  private busy = false;
  constructor(private readonly db: DataSource, private readonly beem: BeemService) {}

  get configured() { return this.beem.isConfigured(); }

  async enqueue(tx: EntityManager, message: Pick<CtzSmsOutbox, 'ownerId' | 'tripId' | 'branchKey' | 'eventKey' | 'phone' | 'body'>) {
    await tx.getRepository(CtzSmsOutbox).createQueryBuilder().insert()
      .values({ ...message, nextAttemptAt: new Date() }).orIgnore().execute();
  }

  async deliverOne() {
    if (!this.configured) return false;
    return this.db.transaction(async (tx) => {
      const repo = tx.getRepository(CtzSmsOutbox);
      const message = await repo.createQueryBuilder('sms').setLock('pessimistic_write').setOnLocked('skip_locked')
        .where('sms.sentAt IS NULL AND sms.attempts < 8 AND sms.nextAttemptAt <= CURRENT_TIMESTAMP')
        .orderBy('sms.nextAttemptAt', 'ASC').take(1).getOne();
      if (!message) return false;
      message.attempts += 1;
      const result = await this.beem.sendSms(message.phone, message.body, AbortSignal.timeout(8000));
      if (result.ok) {
        message.sentAt = new Date();
        // A pickup code is needed in the outbox only until the provider accepts it.
        message.body = '';
      } else {
        message.nextAttemptAt = new Date(Date.now() + Math.min(3600, 15 * 2 ** (message.attempts - 1)) * 1000);
      }
      await repo.save(message);
      return true;
    });
  }

  @Interval(5000)
  async tick() {
    if (process.env.NODE_ENV === 'test' || this.busy || !this.configured) return;
    this.busy = true;
    try { for (let i = 0; i < 10 && await this.deliverOne(); i++) { /* bounded batch */ } }
    catch { this.logger.warn('CargoTZ SMS delivery unavailable. Messages remain queued.'); }
    finally { this.busy = false; }
  }
}
