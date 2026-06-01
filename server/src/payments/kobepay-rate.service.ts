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
   * Active rates: one most-recent active row per (from, to) pair whose
   * effectiveFrom is in the past. Used by the deposit form to pre-fill
   * sales rates and by the risk dashboard to detect overrides.
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

  /** Lookup the current effective rate for a pair, or null. */
  async currentRate(uid: string, from: string, to = 'TZS'): Promise<KobePayRate | null> {
    return this.repo.findOne({
      where: { ownerId: uid, fromCurrency: from, toCurrency: to, active: true, effectiveFrom: LessThanOrEqual(new Date()) },
      order: { effectiveFrom: 'DESC' },
    });
  }

  /**
   * Insert a new rate. We always insert (never update) so the previous
   * rate stays in history — owners can review what the house rate was
   * on any given day. The newest active row wins for new transactions.
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
