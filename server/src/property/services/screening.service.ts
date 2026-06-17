import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { OwnedCrudService } from '../../common/owned.service';
import { TenantScreeningReport, Tenant } from '../property.entity';

/**
 * Tenant screening reports — one row per tenant, lazily created on first
 * `getOrCreate`. The four percentages and overall 300..850 score come
 * from whatever screening provider the operator has configured (today
 * we synthesise demo values from the tenant id so the UI renders
 * meaningfully; swap to a real provider — TransUnion SmartMove,
 * RentPrep, Experian RentBureau — by populating the same fields from
 * the provider's webhook).
 */
@Injectable()
export class TenantScreeningService extends OwnedCrudService<TenantScreeningReport> {
  constructor(
    @InjectRepository(TenantScreeningReport) repo: Repository<TenantScreeningReport>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) { super(repo); }

  /**
   * Return the latest report for a tenant; create a deterministic demo
   * row on first call so the screening UI is never empty. The demo row
   * is marked `provider: 'demo'` so a future real-provider integration
   * can overwrite it without losing operator decisions.
   */
  async getOrCreate(ownerId: string, tenantId: string): Promise<TenantScreeningReport> {
    const tenant = await this.tenants.findOne({ where: { ownerId, id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.repo.findOne({ where: { ownerId, tenantId } });
    if (existing) return existing;

    // Deterministic demo scores so the same tenant always renders the
    // same way until a real provider report lands.
    const seed = (tenant.id.charCodeAt(0) || 1) + (tenant.id.charCodeAt(1) || 1);
    const rental   = 70 + (seed * 7)  % 26;
    const eviction = 30 + (seed * 11) % 50;
    const criminal = 60 + (seed * 5)  % 36;
    const credit   = 40 + (seed * 13) % 50;
    const overall  = 300 + ((rental + eviction + criminal + credit) * 2);

    const created = this.repo.create({
      ownerId,
      tenantId,
      rentalHistoryPct:   rental,
      evictionHistoryPct: eviction,
      criminalHistoryPct: criminal,
      creditHistoryPct:   credit,
      overallScore:       overall,
      verdict:            'pending',
      provider:           'demo',
    } as DeepPartial<TenantScreeningReport>);
    return this.repo.save(created);
  }

  /**
   * Operator accept/reject from the screening UI. Updates the verdict
   * and stamps decidedAt; later joins (tenant onboarding, lease creation)
   * can read this to gate next steps.
   */
  async decide(ownerId: string, tenantId: string, verdict: 'accepted' | 'rejected'): Promise<TenantScreeningReport> {
    const report = await this.getOrCreate(ownerId, tenantId);
    report.verdict = verdict;
    report.decidedAt = new Date();
    return this.repo.save(report);
  }
}
