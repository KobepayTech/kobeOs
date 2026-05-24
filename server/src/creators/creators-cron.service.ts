import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Creator } from './creator.entity';
import { MetricsEngineService } from './metrics-engine.service';

@Injectable()
export class CreatorsCronService {
  private readonly logger = new Logger(CreatorsCronService.name);

  constructor(
    @InjectRepository(Creator) private readonly creators: Repository<Creator>,
    private readonly metrics: MetricsEngineService,
  ) {}

  /**
   * Verify submitted campaign offers every 30 minutes.
   * Checks current metrics against requirements and auto-releases escrow on success.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async verifyCampaigns() {
    try {
      this.logger.debug('Running campaign verification cron');
      await this.metrics.verifyCampaigns();
    } catch (err: any) {
      if (!err?.message?.includes('does not exist')) {
        this.logger.error('verifyCampaigns failed', err?.message);
      }
    }
  }

  /**
   * Refresh metrics for all active creators once per day.
   * Only syncs creators with at least one connected platform and a non-free tier.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async refreshCreatorMetrics() { try {
    const staleDate = new Date(Date.now() - 23 * 60 * 60 * 1000); // older than 23h
    const creators = await this.creators.find({
      where: [
        { subscriptionTier: 'basic',   lastSyncedAt: LessThan(staleDate) },
        { subscriptionTier: 'premium', lastSyncedAt: LessThan(staleDate) },
        { subscriptionTier: 'elite',   lastSyncedAt: LessThan(staleDate) },
      ],
      take: 200, // cap per run to control API credit spend
    });

    this.logger.log(`Refreshing metrics for ${creators.length} creator(s)`);

    for (const creator of creators) {
      if (creator.platforms.filter(Boolean).length === 0) continue;
      try {
        await this.metrics.syncCreator(creator.id);
      } catch (err) {
        this.logger.warn(`Metrics refresh failed for ${creator.handle}: ${(err as Error).message}`);
      }
    }
  } catch (err: any) {
    if (!err?.message?.includes('does not exist')) {
      this.logger.error('refreshCreatorMetrics failed', err?.message);
    }
  } }
}
