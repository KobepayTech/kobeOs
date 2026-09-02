import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnedCrudService } from '../../common/owned.service';
import { TenantScreeningReport, Tenant } from '../property.entity';

/**
 * Verified tenant screening reports only.
 *
 * KobeOS must never synthesise credit, criminal, eviction or rental-history
 * scores. A report is returned only after an external/manual verified provider
 * has written one to tenant_screening_reports.
 */
@Injectable()
export class TenantScreeningService extends OwnedCrudService<TenantScreeningReport> {
  constructor(
    @InjectRepository(TenantScreeningReport) repo: Repository<TenantScreeningReport>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) { super(repo); }

  async getOrCreate(ownerId: string, tenantId: string): Promise<TenantScreeningReport> {
    const tenant = await this.tenants.findOne({ where: { ownerId, id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.repo.findOne({
      where: { ownerId, tenantId },
      order: { updatedAt: 'DESC' },
    });

    // Legacy builds created deterministic fake reports. Remove them rather than
    // ever presenting fabricated credit/criminal/eviction information.
    if (existing?.provider === 'demo') {
      await this.repo.delete({ ownerId, id: existing.id });
    } else if (existing) {
      return existing;
    }

    throw new ServiceUnavailableException(
      'No verified tenant screening report is available. Connect a screening provider or import a verified report before making a screening decision.',
    );
  }

  async decide(ownerId: string, tenantId: string, verdict: 'accepted' | 'rejected'): Promise<TenantScreeningReport> {
    const report = await this.getOrCreate(ownerId, tenantId);
    report.verdict = verdict;
    report.decidedAt = new Date();
    return this.repo.save(report);
  }
}
