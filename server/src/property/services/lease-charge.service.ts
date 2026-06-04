import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { OwnedCrudService } from '../../common/owned.service';
import { PropertyLease, RentCharge } from '../property.entity';
import { asDate, chargeStatus, dueDateFor, money } from './property-utils';

@Injectable()
export class LeasesService extends OwnedCrudService<PropertyLease> {
  constructor(@InjectRepository(PropertyLease) repo: Repository<PropertyLease>) { super(repo); }

  byTenant(ownerId: string, tenantId: string) {
    return this.repo.find({ where: { ownerId, tenantId }, order: { startDate: 'DESC' } });
  }

  byUnit(ownerId: string, unitId: string) {
    return this.repo.find({ where: { ownerId, unitId }, order: { startDate: 'DESC' } });
  }

  override create(ownerId: string, data: DeepPartial<PropertyLease>) {
    return super.create(ownerId, this.normalize(data));
  }

  override update(ownerId: string, id: string, data: DeepPartial<PropertyLease>) {
    return super.update(ownerId, id, this.normalize(data));
  }

  private normalize(data: DeepPartial<PropertyLease>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.startDate) out.startDate = asDate(raw.startDate);
    if (raw.endDate) out.endDate = asDate(raw.endDate);
    return out as DeepPartial<PropertyLease>;
  }
}

@Injectable()
export class RentChargesService extends OwnedCrudService<RentCharge> {
  constructor(
    @InjectRepository(RentCharge) repo: Repository<RentCharge>,
    @InjectRepository(PropertyLease) private readonly leasesRepo: Repository<PropertyLease>,
  ) { super(repo); }

  listByPeriod(ownerId: string, period?: string) {
    return period ? this.repo.find({ where: { ownerId, period }, order: { dueDate: 'ASC' } }) : this.list(ownerId);
  }

  byTenant(ownerId: string, tenantId: string) {
    return this.repo.find({ where: { ownerId, tenantId }, order: { dueDate: 'DESC' } });
  }

  override create(ownerId: string, data: DeepPartial<RentCharge>) {
    return super.create(ownerId, this.normalize(data));
  }

  override update(ownerId: string, id: string, data: DeepPartial<RentCharge>) {
    return super.update(ownerId, id, this.normalize(data));
  }

  private normalize(data: DeepPartial<RentCharge>) {
    const raw = data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...raw };
    if (raw.dueDate) out.dueDate = asDate(raw.dueDate);
    return out as DeepPartial<RentCharge>;
  }

  async generate(ownerId: string, period: string) {
    const leases = await this.leasesRepo.find({ where: { ownerId, status: 'active' } });
    let created = 0;
    const charges: RentCharge[] = [];
    for (const lease of leases) {
      const existing = await this.repo.findOne({ where: { ownerId, leaseId: lease.id, period } });
      if (existing) {
        charges.push(existing);
        continue;
      }
      const charge = this.repo.create({
        ownerId,
        leaseId: lease.id,
        tenantId: lease.tenantId,
        unitId: lease.unitId,
        period,
        dueDate: dueDateFor(period, lease.rentDueDay),
        amount: lease.monthlyRent,
        amountPaid: 0,
        status: 'open',
        notes: '',
      });
      charge.status = chargeStatus(charge);
      charges.push(await this.repo.save(charge));
      created += 1;
    }
    return { period, created, charges };
  }

  async applyPayment(ownerId: string, chargeId: string, amount: number) {
    const charge = await this.get(ownerId, chargeId);
    charge.amountPaid = money(charge.amountPaid) + money(amount);
    charge.status = chargeStatus(charge);
    return this.repo.save(charge);
  }

  async removePayment(ownerId: string, chargeId: string, amount: number) {
    const charge = await this.get(ownerId, chargeId);
    charge.amountPaid = Math.max(0, money(charge.amountPaid) - money(amount));
    charge.status = chargeStatus(charge);
    return this.repo.save(charge);
  }

  async waive(ownerId: string, id: string) {
    const charge = await this.get(ownerId, id);
    charge.status = 'waived';
    return this.repo.save(charge);
  }
}
