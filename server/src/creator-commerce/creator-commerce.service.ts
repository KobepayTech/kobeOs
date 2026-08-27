import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { PlatformEventsService } from '../platform/platform.service';
import { Creator } from '../creators/creator.entity';
import {
  CommissionState, CreatorAttributionEvent, CreatorAttributionLink, CreatorCommission,
} from './creator-commerce.entity';

/** URL-safe, unambiguous short code (no 0/O/1/I). */
function shortCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export interface CreateLinkInput {
  ownerId: string;
  creatorId: string;
  campaignId?: string | null;
  productId?: string | null;
  destination?: 'jumla' | 'store' | 'url';
  destinationUrl: string;
  commissionPercent?: number;
  promoCode?: string;
  currency?: string;
}

@Injectable()
export class CreatorCommerceService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(CreatorAttributionLink) private readonly links: Repository<CreatorAttributionLink>,
    @InjectRepository(CreatorAttributionEvent) private readonly eventsRepo: Repository<CreatorAttributionEvent>,
    @InjectRepository(CreatorCommission) private readonly commissions: Repository<CreatorCommission>,
    @InjectRepository(Creator) private readonly creators: Repository<Creator>,
    private readonly platform: PlatformEventsService,
  ) {}

  /**
   * Safe, public "shopping <creator>'s pick" info for a link code — the display
   * identity of the creator plus the promoted product. No tokens, no owner ids.
   */
  async publicLinkInfo(code: string) {
    const link = await this.links.findOne({ where: { code: code.toUpperCase() } });
    if (!link || !link.active) return null;
    const creator = await this.creators.findOne({ where: { id: link.creatorId } });
    return {
      code: link.code,
      productId: link.productId ?? null,
      campaignId: link.campaignId ?? null,
      promoCode: link.promoCode || null,
      creator: creator ? { handle: creator.handle, name: creator.name, avatarUrl: creator.avatarUrl ?? null } : null,
    };
  }

  // ── Links ────────────────────────────────────────────────────────────────

  async createLink(input: CreateLinkInput): Promise<CreatorAttributionLink> {
    if (!input.destinationUrl?.trim()) throw new BadRequestException('A destination URL is required');
    const percent = Number(input.commissionPercent ?? 0);
    if (percent < 0 || percent > 100) throw new BadRequestException('Commission percent must be between 0 and 100');
    // Retry on the rare code collision (unique index).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = shortCode();
      try {
        const link = await this.links.save(this.links.create({
          ownerId: input.ownerId,
          creatorId: input.creatorId,
          campaignId: input.campaignId ?? null,
          productId: input.productId ?? null,
          destination: input.destination ?? 'jumla',
          destinationUrl: input.destinationUrl.trim(),
          commissionPercent: percent,
          promoCode: (input.promoCode ?? '').trim().toUpperCase(),
          currency: input.currency ?? 'TZS',
          code,
        }));
        await this.platform.emit({ ownerId: input.ownerId, eventName: 'creator.link_created', aggregateType: 'CreatorAttributionLink', aggregateId: link.id, payload: { code, creatorId: input.creatorId, campaignId: input.campaignId ?? null } });
        return link;
      } catch (e) {
        if ((e as { code?: string }).code === '23505') continue; // duplicate code, retry
        throw e;
      }
    }
    throw new BadRequestException('Could not allocate a unique link code, please retry');
  }

  listLinks(ownerId: string) {
    return this.links.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  linksForCreator(creatorId: string) {
    return this.links.find({ where: { creatorId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Resolve a click: record the CLICK event, bump the counter, and return the
   * destination URL with the attribution code + click id appended so the
   * landing page (Jumla/storefront) can forward them on to the order.
   */
  async resolveClick(code: string, clickId: string, metadata: Record<string, unknown> = {}): Promise<{ url: string; clickId: string } | null> {
    const link = await this.links.findOne({ where: { code: code.toUpperCase() } });
    if (!link || !link.active) return null;
    const id = clickId?.trim() || shortCode(12);
    await this.links.increment({ id: link.id }, 'clicks', 1);
    await this.eventsRepo.save(this.eventsRepo.create({ linkId: link.id, code: link.code, type: 'CLICK', clickId: id, metadata }));
    await this.platform.emit({ ownerId: link.ownerId, eventName: 'creator.attribution_clicked', aggregateType: 'CreatorAttributionLink', aggregateId: link.id, payload: { code: link.code, clickId: id } });
    const sep = link.destinationUrl.includes('?') ? '&' : '?';
    const url = `${link.destinationUrl}${sep}kc=${encodeURIComponent(link.code)}&kcid=${encodeURIComponent(id)}`;
    return { url, clickId: id };
  }

  // ── Order attribution ──────────────────────────────────────────────────────

  /**
   * Record an order against an attribution code. Idempotent per (order, link):
   * creates ORDER + SALE funnel events and a PENDING commission. Best-effort —
   * callers wrap this so a bad code never blocks a real order.
   */
  async attributeOrder(params: {
    code: string; clickId?: string; orderId: string; revenue: number; currency?: string; productId?: string | null;
  }): Promise<CreatorCommission | null> {
    const link = await this.links.findOne({ where: { code: params.code.toUpperCase() } });
    if (!link || !link.active) return null;
    const currency = params.currency ?? link.currency ?? 'TZS';
    const revenue = Number(params.revenue) || 0;
    const amount = Math.round(revenue * (Number(link.commissionPercent) / 100) * 10000) / 10000;

    return this.ds.transaction(async (tx) => {
      const commRepo = tx.getRepository(CreatorCommission);
      // One commission per (order, link). Guard the insert; if it already
      // exists, this attribution already ran — return the existing row.
      const existing = await commRepo.findOne({ where: { orderId: params.orderId, linkId: link.id } });
      if (existing) return existing;

      const evRepo = tx.getRepository(CreatorAttributionEvent);
      await evRepo.save([
        evRepo.create({ linkId: link.id, code: link.code, type: 'ORDER', clickId: params.clickId ?? '', orderId: params.orderId, revenue, currency, metadata: { productId: params.productId ?? null } }),
        evRepo.create({ linkId: link.id, code: link.code, type: 'SALE', clickId: params.clickId ?? '', orderId: params.orderId, revenue, currency }),
      ]);
      const commission = await commRepo.save(commRepo.create({
        linkId: link.id, campaignId: link.campaignId ?? null, creatorId: link.creatorId, ownerId: link.ownerId,
        orderId: params.orderId, productId: params.productId ?? link.productId ?? null,
        baseAmount: revenue, rate: link.commissionPercent, amount, currency, state: 'PENDING',
      }));
      await this.platform.emit({ ownerId: link.ownerId, eventName: 'creator.order_attributed', aggregateType: 'CreatorCommission', aggregateId: commission.id, payload: { code: link.code, creatorId: link.creatorId, orderId: params.orderId, revenue } });
      return commission;
    });
  }

  /** Order completed → commission becomes EARNED (a real, owed sale). */
  async markOrderCompleted(orderId: string): Promise<void> {
    const rows = await this.commissions.find({ where: { orderId } });
    for (const c of rows) {
      if (c.state !== 'PENDING') continue;
      c.state = 'EARNED';
      c.earnedAt = new Date();
      await this.commissions.save(c);
      await this.platform.emit({ ownerId: c.ownerId, eventName: 'creator.commission_earned', aggregateType: 'CreatorCommission', aggregateId: c.id, payload: { creatorId: c.creatorId, orderId, amount: c.amount } });
    }
  }

  /** Order cancelled/refunded/fraudulent → commission REVERSED (never paid). */
  async reverseOrder(orderId: string, reason = 'order_cancelled'): Promise<void> {
    const rows = await this.commissions.find({ where: { orderId } });
    for (const c of rows) {
      if (c.state === 'PAID' || c.state === 'REVERSED') continue;
      c.state = 'REVERSED';
      await this.commissions.save(c);
      await this.eventsRepo.save(this.eventsRepo.create({ linkId: c.linkId, code: '', type: 'REVERSED', orderId, revenue: c.baseAmount, currency: c.currency, metadata: { reason } }));
      await this.platform.emit({ ownerId: c.ownerId, eventName: 'creator.commission_reversed', aggregateType: 'CreatorCommission', aggregateId: c.id, payload: { creatorId: c.creatorId, orderId, reason } });
    }
  }

  // ── Reporting ──────────────────────────────────────────────────────────────

  commissionsForCreator(creatorId: string) {
    return this.commissions.find({ where: { creatorId }, order: { createdAt: 'DESC' } });
  }

  commissionsForOwner(ownerId: string) {
    return this.commissions.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async campaignPerformance(ownerId: string, campaignId: string) {
    const links = await this.links.find({ where: { ownerId, campaignId } });
    const linkIds = links.map((l) => l.id);
    const clicks = links.reduce((sum, l) => sum + Number(l.clicks), 0);
    const commissions = linkIds.length ? await this.commissions.find({ where: linkIds.map((linkId) => ({ linkId })) }) : [];
    const attributed = commissions.filter((c) => c.state !== 'REVERSED');
    const revenue = attributed.reduce((sum, c) => sum + Number(c.baseAmount), 0);
    const commissionOwed = attributed.reduce((sum, c) => sum + Number(c.amount), 0);
    return {
      campaignId,
      links: links.length,
      clicks,
      orders: attributed.length,
      revenue,
      commissionOwed,
      earned: commissions.filter((c) => c.state === 'EARNED' || c.state === 'PAYABLE' || c.state === 'PAID').reduce((s, c) => s + Number(c.amount), 0),
      conversionRate: clicks > 0 ? Math.round((attributed.length / clicks) * 10000) / 100 : 0,
    };
  }

  async getLinkOrThrow(ownerId: string, id: string) {
    const link = await this.links.findOne({ where: { id, ownerId } });
    if (!link) throw new NotFoundException('Link not found');
    return link;
  }

  countByState(creatorId: string): Promise<Array<{ state: CommissionState; total: string; n: string }>> {
    return this.commissions.createQueryBuilder('c')
      .select('c.state', 'state').addSelect('SUM(c.amount)', 'total').addSelect('COUNT(*)', 'n')
      .where('c.creatorId = :creatorId', { creatorId })
      .groupBy('c.state')
      .getRawMany();
  }
}
