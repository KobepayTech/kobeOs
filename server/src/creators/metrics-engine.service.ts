import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator, FraudSignals, PlatformStats } from './creator.entity';
import { Campaign } from './campaign.entity';
import { ScrapeCreatorsService } from './scrape-creators.service';
import { CampaignService } from './campaign.service';
import { EscrowService } from './escrow.service';

// ── Fraud thresholds ──────────────────────────────────────────────────────────

const FRAUD = {
  /** Engagement rate below this % is suspicious */
  MIN_ENGAGEMENT_RATE: 0.5,
  /** Views-to-followers ratio below this is suspicious */
  MIN_VIEW_FOLLOWER_RATIO: 0.005,
  /** Fraud score above this triggers a warning flag */
  HIGH_FRAUD_SCORE: 60,
};

@Injectable()
export class MetricsEngineService {
  private readonly logger = new Logger(MetricsEngineService.name);

  constructor(
    @InjectRepository(Creator)  private readonly creators: Repository<Creator>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    private readonly scraper: ScrapeCreatorsService,
    private readonly campaignSvc: CampaignService,
    private readonly escrowSvc: EscrowService,
  ) {}

  // ── Creator sync ────────────────────────────────────────────────────────────

  /**
   * Fetch fresh stats for a single creator across all connected platforms,
   * update the creator record, and recompute fraud signals.
   */
  async syncCreator(creatorId: string): Promise<Creator> {
    const creator = await this.creators.findOneOrFail({ where: { id: creatorId } });
    const updatedStats: PlatformStats[] = [];

    for (const platform of creator.platforms as Array<'tiktok' | 'instagram' | 'youtube'>) {
      // Find the handle for this platform from existing stats, fall back to creator.handle
      const existing = creator.platformStats.find((s) => s.platform === platform);
      const handle = existing?.handle ?? creator.handle;

      try {
        let kit;
        if (platform === 'tiktok')    kit = await this.scraper.fetchTikTok(handle);
        else if (platform === 'instagram') kit = await this.scraper.fetchInstagram(handle);
        else                          kit = await this.scraper.fetchYouTube(handle);

        updatedStats.push(kit.stats);
        this.logger.debug(`Synced ${platform}/${handle}: ${kit.stats.followers} followers`);
      } catch (err) {
        this.logger.warn(`Sync failed for ${platform}/${handle}: ${(err as Error).message}`);
        // Keep existing stats on failure
        if (existing) updatedStats.push(existing);
      }
    }

    // Aggregate across platforms
    const totalFollowers = updatedStats.reduce((s, p) => s + p.followers, 0);
    const avgEngagement = updatedStats.length > 0
      ? updatedStats.reduce((s, p) => s + p.engagementRate, 0) / updatedStats.length
      : 0;
    const avgViews = updatedStats.length > 0
      ? updatedStats.reduce((s, p) => s + p.avgViews, 0) / updatedStats.length
      : 0;

    const fraudSignals = this.computeFraudSignals(updatedStats, creator.fraudSignals ?? undefined);

    const updated = await this.creators.save({
      ...creator,
      platformStats: updatedStats,
      followers: totalFollowers,
      engagement: parseFloat(avgEngagement.toFixed(2)),
      avgViews: parseFloat(avgViews.toFixed(0)),
      fraudSignals,
      lastSyncedAt: new Date(),
    });

    if (fraudSignals.fraudScore >= FRAUD.HIGH_FRAUD_SCORE) {
      this.logger.warn(
        `High fraud score (${fraudSignals.fraudScore}) for creator ${creator.handle}`,
      );
    }

    return updated;
  }

  // ── Campaign verification ───────────────────────────────────────────────────

  /**
   * Check all submitted offers in verifying campaigns.
   * For each submitted offer, fetch current metrics on the proof URLs' platforms
   * and compare against campaign requirements.
   * Called by the cron every 30 minutes.
   */
  async verifyCampaigns(): Promise<void> {
    const verifyingCampaigns = await this.campaigns.find({ where: { status: 'verifying' } });
    if (verifyingCampaigns.length === 0) return;

    this.logger.log(`Verifying ${verifyingCampaigns.length} campaign(s)`);

    for (const campaign of verifyingCampaigns) {
      const submittedOffers = campaign.offers.filter((o) => o.status === 'submitted');

      for (const offer of submittedOffers) {
        await this.verifyOffer(campaign, offer.id);
      }
    }
  }

  private async verifyOffer(campaign: Campaign, offerId: string): Promise<void> {
    const offer = campaign.offers.find((o) => o.id === offerId);
    if (!offer) return;

    const creator = await this.creators.findOne({ where: { id: offer.creatorId } });
    if (!creator) return;

    // Re-fetch creator metrics to get current view counts
    let totalViews = 0;
    let totalLikes = 0;

    for (const platform of creator.platforms as Array<'tiktok' | 'instagram' | 'youtube'>) {
      const existing = creator.platformStats.find((s) => s.platform === platform);
      const handle = existing?.handle ?? creator.handle;
      try {
        let kit;
        if (platform === 'tiktok')         kit = await this.scraper.fetchTikTok(handle);
        else if (platform === 'instagram')  kit = await this.scraper.fetchInstagram(handle);
        else                               kit = await this.scraper.fetchYouTube(handle);

        totalViews += kit.stats.avgViews;
        totalLikes += kit.stats.avgLikes;
      } catch {
        // Use last known values
        if (existing) {
          totalViews += existing.avgViews;
          totalLikes += existing.avgLikes;
        }
      }
    }

    // Check against requirements
    const req = campaign.requirements[0]; // primary requirement
    const meetsViews = !req || totalViews >= req.minViews;
    const meetsLikes = !req?.minLikes || totalLikes >= req.minLikes;

    if (meetsViews && meetsLikes) {
      await this.campaignSvc.markOfferVerified(campaign.id, offerId, totalViews, totalLikes);
      this.logger.log(
        `Offer ${offerId} verified: ${totalViews} views (req: ${req?.minViews ?? 0})`,
      );

      // Auto-release escrow if creator has a wallet
      const escrows = await this.escrowSvc.findByCampaign(campaign.id);
      const escrow = escrows.find((e) => e.offerId === offerId && e.status === 'held');
      if (escrow) {
        // Find creator's first active wallet
        const creatorWallets = await this.findCreatorWallet(offer.creatorId);
        if (creatorWallets) {
          await this.escrowSvc.release(escrow.id, creatorWallets);
          await this.campaignSvc.markOfferPaid(campaign.id, offerId);
          this.logger.log(`Escrow auto-released for offer ${offerId}`);
        }
      }
    } else {
      // Check if deadline has passed — if so, mark failed and refund
      const deadline = req?.deadline ? new Date(req.deadline) : null;
      if (deadline && new Date() > deadline) {
        this.logger.warn(
          `Offer ${offerId} failed: ${totalViews} views < ${req?.minViews} required, deadline passed`,
        );
        const escrows = await this.escrowSvc.findByCampaign(campaign.id);
        const escrow = escrows.find((e) => e.offerId === offerId && e.status === 'held');
        if (escrow) {
          await this.escrowSvc.refund(escrow.id, 'KPI requirements not met by deadline');
        }
      } else {
        this.logger.debug(
          `Offer ${offerId}: ${totalViews}/${req?.minViews ?? 0} views — still within deadline`,
        );
      }
    }
  }

  // ── Fraud detection ─────────────────────────────────────────────────────────

  computeFraudSignals(
    stats: PlatformStats[],
    previous?: Partial<FraudSignals>,
  ): FraudSignals {
    if (stats.length === 0) {
      return {
        lowEngagement: false,
        followerSpike: false,
        viewFollowerMismatch: false,
        fraudScore: 0,
        checkedAt: new Date().toISOString(),
      };
    }

    const avgEngagement = stats.reduce((s, p) => s + p.engagementRate, 0) / stats.length;
    const totalFollowers = stats.reduce((s, p) => s + p.followers, 0);
    const totalAvgViews  = stats.reduce((s, p) => s + p.avgViews, 0) / stats.length;

    const lowEngagement = avgEngagement < FRAUD.MIN_ENGAGEMENT_RATE && totalFollowers > 10_000;

    const viewFollowerMismatch =
      totalFollowers > 10_000 &&
      totalAvgViews > 0 &&
      totalAvgViews / totalFollowers < FRAUD.MIN_VIEW_FOLLOWER_RATIO;

    // Follower spike: compare to previous snapshot if available
    // (a real implementation would store historical snapshots)
    const followerSpike = previous?.followerSpike ?? false;

    // Composite score
    let fraudScore = 0;
    if (lowEngagement)         fraudScore += 35;
    if (viewFollowerMismatch)  fraudScore += 40;
    if (followerSpike)         fraudScore += 25;

    return {
      lowEngagement,
      followerSpike,
      viewFollowerMismatch,
      fraudScore: Math.min(100, fraudScore),
      checkedAt: new Date().toISOString(),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findCreatorWallet(creatorId: string): Promise<string | null> {
    // Dynamically import to avoid circular deps
    const { Wallet } = await import('../payments/payments.entity');
    const walletRepo = this.creators.manager.getRepository(Wallet);
    const wallet = await walletRepo.findOne({ where: { ownerId: creatorId } });
    return wallet?.id ?? null;
  }
}
