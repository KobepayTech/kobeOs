import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { KobePayRate } from './kobepay-rate.entity';
import { AuditContext, KobePayRbacService } from './kobepay-rbac.service';

export interface UpsertRateInput {
  fromCurrency: string;
  toCurrency?: string;
  salesRate: number;
  costRate: number;
  effectiveFrom?: string;
  notes?: string;
}

/** Base/quote currency for the whole rate system. All admin-set rates
 *  hang off USD; cross-rates between any two non-USD currencies are
 *  derived as (USD→to) / (USD→from). */
export const BASE_CURRENCY = 'USD';

export interface ResolvedRate {
  salesRate: number;
  costRate: number;
  source: 'direct' | 'derived' | 'none';
  via?: string;
}

@Injectable()
export class KobePayRatesService {
  constructor(
    @InjectRepository(KobePayRate) private readonly repo: Repository<KobePayRate>,
    private readonly rbac: KobePayRbacService,
  ) {}

  /** All rates ever set (newest first); for the admin history view. */
  list(uid: string, ctx: AuditContext) {
    this.rbac.ensure(ctx.user ?? null, 'rate.manage');
    return this.repo.find({ where: { ownerId: uid }, order: { effectiveFrom: 'DESC' } });
  }

  /**
   * Active *source-of-truth* rates: one most-recent active row per
   * (from, to) pair. Includes both the USD-based rates the admin
   * actually sets and any legacy direct pairs.
   */
  async active(uid: string) {
    const all = await this.repo.find({
      where: { ownerId: uid, active: true, effectiveFrom: LessThanOrEqual(new Date()) },
      order: { effectiveFrom: 'DESC' },
    });
    const seen = new Set<string>();
    const result: KobePayRate[] = [];
    for (const r of all) {
      const key = `${r.fromCurrency}->${r.toCurrency}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(r);
    }
    return result;
  }

  /**
   * Derived cross-rates for non-USD pairs: e.g. given USD→CNY=6.7 and
   * USD→TZS=2630, surface CNY→TZS=392.537 as a suggestion. These never
   * persist — they recompute every call from the current base rates so
   * a single admin edit to USD→TZS propagates everywhere.
   */
  async derivedCrossRates(uid: string) {
    const active = await this.active(uid);
    const usdRates = active.filter((r) => r.fromCurrency === BASE_CURRENCY);
    if (usdRates.length < 2) return [];
    const out: Array<{ fromCurrency: string; toCurrency: string; salesRate: number; costRate: number; viaBase: true }> = [];
    for (const from of usdRates) {
      for (const to of usdRates) {
        if (from.toCurrency === to.toCurrency) continue;
        const sales = Number(to.salesRate) / Number(from.salesRate);
        const cost = Number(to.costRate) / Number(from.costRate);
        out.push({
          fromCurrency: from.toCurrency,
          toCurrency: to.toCurrency,
          salesRate: parseFloat(sales.toFixed(6)),
          costRate: parseFloat(cost.toFixed(6)),
          viaBase: true,
        });
      }
    }
    return out;
  }

  /**
   * Resolve the effective sales+cost rate for any pair. Prefers a
   * directly-stored pair (legacy); otherwise derives via USD. Returns
   * `none` only when neither USD→from nor USD→to is configured.
   */
  async resolveRate(uid: string, from: string, to: string): Promise<ResolvedRate> {
    if (from === to) return { salesRate: 1, costRate: 1, source: 'direct' };

    const direct = await this.repo.findOne({
      where: { ownerId: uid, fromCurrency: from, toCurrency: to, active: true, effectiveFrom: LessThanOrEqual(new Date()) },
      order: { effectiveFrom: 'DESC' },
    });
    if (direct) {
      return { salesRate: Number(direct.salesRate), costRate: Number(direct.costRate), source: 'direct' };
    }

    // Derive via USD: (USD→to) / (USD→from). USD itself collapses cleanly.
    const fromBase = from === BASE_CURRENCY
      ? { salesRate: 1, costRate: 1 } as { salesRate: number; costRate: number }
      : await this.repo.findOne({
          where: { ownerId: uid, fromCurrency: BASE_CURRENCY, toCurrency: from, active: true, effectiveFrom: LessThanOrEqual(new Date()) },
          order: { effectiveFrom: 'DESC' },
        }).then((r) => r ? { salesRate: Number(r.salesRate), costRate: Number(r.costRate) } : null);
    const toBase = to === BASE_CURRENCY
      ? { salesRate: 1, costRate: 1 } as { salesRate: number; costRate: number }
      : await this.repo.findOne({
          where: { ownerId: uid, fromCurrency: BASE_CURRENCY, toCurrency: to, active: true, effectiveFrom: LessThanOrEqual(new Date()) },
          order: { effectiveFrom: 'DESC' },
        }).then((r) => r ? { salesRate: Number(r.salesRate), costRate: Number(r.costRate) } : null);

    if (!fromBase || !toBase) return { salesRate: 0, costRate: 0, source: 'none' };
    return {
      salesRate: parseFloat((toBase.salesRate / fromBase.salesRate).toFixed(6)),
      costRate: parseFloat((toBase.costRate / fromBase.costRate).toFixed(6)),
      source: 'derived',
      via: BASE_CURRENCY,
    };
  }

  /** Lookup the current effective rate for a pair, or null. Returns a
   *  KobePayRate-shaped object for backward compatibility with callers
   *  that read `salesRate` / `costRate` directly. */
  async currentRate(uid: string, from: string, to = 'TZS'): Promise<{ salesRate: number; costRate: number } | null> {
    const r = await this.resolveRate(uid, from, to);
    if (r.source === 'none') return null;
    return { salesRate: r.salesRate, costRate: r.costRate };
  }

  /**
   * Insert a new rate. We always insert (never update) so the previous
   * rate stays in history — owners can review what the house rate was
   * on any given day. The newest active row wins for new transactions.
   *
   * Best practice is to set USD-based rates (fromCurrency='USD') and
   * let cross-rates derive. Direct non-USD rates are still accepted
   * for legacy callers but won't propagate when USD rates change.
   */
  async setRate(uid: string, ctx: AuditContext, input: UpsertRateInput) {
    this.rbac.ensure(ctx.user ?? null, 'rate.manage');
    if (input.salesRate <= 0 || input.costRate <= 0) {
      throw new BadRequestException('Both salesRate and costRate must be > 0');
    }
    const row = this.repo.create({
      ownerId: uid,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency ?? 'TZS',
      salesRate: input.salesRate,
      costRate: input.costRate,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      active: true,
      notes: input.notes ?? '',
    });
    const saved = await this.repo.save(row);
    await this.rbac.record(uid, ctx, 'rate.set', 'rate', saved.id, {
      pair: `${saved.fromCurrency}->${saved.toCurrency}`,
      salesRate: saved.salesRate,
      costRate: saved.costRate,
    });
    return saved;
  }

  /** Deactivate an old row (e.g. mistakes); a fresh setRate() is the
   *  normal way to change the effective rate. */
  async deactivate(uid: string, ctx: AuditContext, id: string) {
    this.rbac.ensure(ctx.user ?? null, 'rate.manage');
    const r = await this.repo.findOne({ where: { id, ownerId: uid } });
    if (!r) throw new NotFoundException();
    r.active = false;
    await this.repo.save(r);
    await this.rbac.record(uid, ctx, 'rate.deactivate', 'rate', r.id, {
      pair: `${r.fromCurrency}->${r.toCurrency}`,
    });
    return r;
  }
}
