import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { PlatformEventsService } from '../platform/platform.service';
import { Creator } from '../creators/creator.entity';
import { AccountantService } from '../accountant/accountant.service';
import {
  CommissionState, CreatorAttributionEvent, CreatorAttributionLink, CreatorCommission, CreatorPayout,
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
    @InjectRepository(CreatorPayout) private readonly payouts: Repository<CreatorPayout>,
    @InjectRepository(Creator) private readonly creators: Repository<Creator>,
    private readonly platform: PlatformEventsService,
    private readonly accountant: AccountantService,
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

  /** Resolve a creator discount code (e.g. AMINA10) to its link — a second
   * attribution path that needs no prior click. */
  resolvePromoCode(promoCode: string) {
    return this.links.findOne({ where: { promoCode: promoCode.trim().toUpperCase(), active: true } });
  }

  /** Safe public info for a promo code (creator + product), for checkout display. */
  async publicPromoInfo(promoCode: string) {
    const link = await this.resolvePromoCode(promoCode);
    if (!link) return null;
    const creator = await this.creators.findOne({ where: { id: link.creatorId } });
    return {
      code: link.code,
      promoCode: link.promoCode,
      productId: link.productId ?? null,
      creator: creator ? { handle: creator.handle, name: creator.name, avatarUrl: creator.avatarUrl ?? null } : null,
    };
  }

  /**
   * Record an order against an attribution code OR a creator promo code.
   * Idempotent per (order, link): creates ORDER + SALE funnel events and a
   * PENDING commission. Best-effort — callers wrap this so a bad code never
   * blocks a real order.
   */
  async attributeOrder(params: {
    code?: string; promoCode?: string; clickId?: string; orderId: string; revenue: number; currency?: string; productId?: string | null;
  }): Promise<CreatorCommission | null> {
    const link = params.code
      ? await this.links.findOne({ where: { code: params.code.toUpperCase() } })
      : params.promoCode
        ? await this.resolvePromoCode(params.promoCode)
        : null;
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

  // ── Payouts (EARNED → PAYABLE → PAID) ──────────────────────────────────────

  /** Stage a creator's EARNED commissions (from this owner) as PAYABLE. */
  async markPayable(ownerId: string, creatorId: string) {
    const rows = await this.commissions.find({ where: { ownerId, creatorId, state: 'EARNED' } });
    for (const c of rows) { c.state = 'PAYABLE'; }
    if (rows.length) await this.commissions.save(rows);
    return { moved: rows.length };
  }

  /**
   * Pay out a creator's owed commissions (EARNED + PAYABLE) from one advertiser/
   * merchant. Marks them PAID, records a CreatorPayout, and posts a classified
   * marketing expense to Kobe Accountant. Idempotent-safe: recomputes from
   * current state each call and no-ops when nothing is owed.
   */
  async payoutCreator(ownerId: string, creatorId: string) {
    return this.ds.transaction(async (tx) => {
      const commRepo = tx.getRepository(CreatorCommission);
      const owed = await commRepo.createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.ownerId = :ownerId AND c.creatorId = :creatorId', { ownerId, creatorId })
        .andWhere("c.state IN ('EARNED','PAYABLE')")
        .getMany();
      if (!owed.length) throw new BadRequestException('No earned commissions to pay out');
      const currency = owed[0].currency || 'TZS';
      const amount = Math.round(owed.reduce((s, c) => s + Number(c.amount), 0) * 10000) / 10000;
      const reference = `JCP-${randomBytes(4).toString('hex').toUpperCase()}`;

      const payout = await tx.getRepository(CreatorPayout).save(tx.getRepository(CreatorPayout).create({
        creatorId, ownerId, amount, currency, commissionCount: owed.length,
        commissionIds: owed.map((c) => c.id), status: 'PAID', reference, paidAt: new Date(),
      }));
      for (const c of owed) { c.state = 'PAID'; }
      await commRepo.save(owed);

      // Post to Kobe Accountant as a marketing expense (best-effort; never fail
      // the payout on a bookkeeping hiccup).
      try {
        const creator = await tx.getRepository(Creator).findOne({ where: { id: creatorId } });
        const ft = await this.accountant.recordCreatorPayout(ownerId, {
          payoutId: payout.id, amount, currency,
          counterparty: creator ? (creator.handle || creator.name) : 'Creator',
          reference,
        });
        payout.financialTransactionId = ft?.id ?? '';
        await tx.getRepository(CreatorPayout).save(payout);
      } catch { /* accounting is advisory here */ }

      await this.platform.emit({ ownerId, eventName: 'creator.payout_released', aggregateType: 'CreatorPayout', aggregateId: payout.id, payload: { creatorId, amount, currency, commissionCount: owed.length } });
      return payout;
    });
  }

  payoutsForOwner(ownerId: string) {
    return this.payouts.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  payoutsForCreator(creatorId: string) {
    return this.payouts.find({ where: { creatorId }, order: { createdAt: 'DESC' } });
  }

  // ── Reporting ──────────────────────────────────────────────────────────────

  /**
   * Creator commerce scorecard: the "verified sales generated" numbers that make
   * a creator's revenue their headline metric (spec §198, §203). Only counts
   * non-reversed commissions.
   */
  async creatorStats(creatorId: string) {
    const [links, commissions, payouts] = await Promise.all([
      this.links.find({ where: { creatorId } }),
      this.commissions.find({ where: { creatorId } }),
      this.payouts.find({ where: { creatorId } }),
    ]);
    const clicks = links.reduce((sum, l) => sum + Number(l.clicks), 0);
    const live = commissions.filter((c) => c.state !== 'REVERSED');
    const revenue = live.reduce((s, c) => s + Number(c.baseAmount), 0);
    const orders = live.length;
    const paidOut = payouts.reduce((s, p) => s + Number(p.amount), 0);
    const byState = (s: CommissionState) => live.filter((c) => c.state === s).reduce((sum, c) => sum + Number(c.amount), 0);
    return {
      creatorId,
      links: links.length,
      clicks,
      orders,
      revenue,                 // verified sales the creator generated
      avgOrderValue: orders ? Math.round((revenue / orders) * 100) / 100 : 0,
      conversionRate: clicks > 0 ? Math.round((orders / clicks) * 10000) / 100 : 0,
      commission: {
        pending: byState('PENDING'),
        earned: byState('EARNED'),
        payable: byState('PAYABLE'),
        paid: byState('PAID'),
      },
      paidOut,
    };
  }

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
